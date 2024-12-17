use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};
use notify::{Watcher, RecursiveMode, Event};
use std::sync::mpsc::channel;
use std::time::Duration;
use log::{info, error, debug};
use crate::FileItem;

#[cfg(target_os = "windows")]
use windows::Win32::Storage::FileSystem::{GetLogicalDrives, GetDriveTypeW};
#[cfg(target_os = "linux")]
use std::fs;
#[cfg(target_os = "macos")]
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Device {
    name: String,
    path: String,
    #[serde(rename = "deviceType")]
    device_type: String,
    removable: bool,
}

#[tauri::command]
pub async fn get_connected_devices() -> Result<Vec<Device>, String> {
    #[cfg(target_os = "windows")]
    {
        get_windows_devices().await
    }
    #[cfg(target_os = "linux")]
    {
        get_linux_devices().await
    }
    #[cfg(target_os = "macos")]
    {
        get_macos_devices().await
    }
}

#[cfg(target_os = "windows")]
async fn get_windows_devices() -> Result<Vec<Device>, String> {
    let mut devices = Vec::new();
    
    unsafe {
        let drives_bitmask = GetLogicalDrives();
        for i in 0..26 {
            if (drives_bitmask & (1 << i)) != 0 {
                let drive_letter = (b'A' + i as u8) as char;
                let path = format!("{}:\\", drive_letter);
                let path_wide: Vec<u16> = format!("{}:\\", drive_letter)
                    .encode_utf16()
                    .chain(std::iter::once(0))
                    .collect();
                
                let drive_type = GetDriveTypeW(path_wide.as_ptr());
                
                // 2 = Removable, 3 = Fixed, 4 = Network, 5 = CD-ROM, 6 = RAM disk
                if drive_type > 1 {
                    devices.push(Device {
                        name: format!("Drive ({}:)", drive_letter),
                        path: path.clone(),
                        device_type: match drive_type {
                            2 => "removable".to_string(),
                            3 => "fixed".to_string(),
                            4 => "network".to_string(),
                            5 => "cdrom".to_string(),
                            6 => "ramdisk".to_string(),
                            _ => "unknown".to_string(),
                        },
                        removable: drive_type == 2,
                    });
                }
            }
        }
    }
    
    Ok(devices)
}

#[cfg(target_os = "linux")]
async fn get_linux_devices() -> Result<Vec<Device>, String> {
    let mut devices = Vec::new();
    
    // Read /proc/mounts to get mounted devices
    let mounts = fs::read_to_string("/proc/mounts")
        .map_err(|e| format!("Failed to read mounts: {}", e))?;
    
    for line in mounts.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let device_path = parts[0];
            let mount_point = parts[1];
            
            // Filter out system mounts
            if !mount_point.starts_with("/dev") && 
               !mount_point.starts_with("/sys") && 
               !mount_point.starts_with("/proc") {
                
                let removable = device_path.contains("usb") || 
                               fs::read_to_string(format!("/sys/block/{}/removable", 
                                   device_path.split('/').last().unwrap_or("")))
                               .unwrap_or_default()
                               .trim() == "1";
                
                devices.push(Device {
                    name: mount_point.split('/').last()
                        .unwrap_or(mount_point)
                        .to_string(),
                    path: mount_point.to_string(),
                    device_type: if removable { "removable".to_string() } 
                                else { "fixed".to_string() },
                    removable,
                });
            }
        }
    }
    
    Ok(devices)
}

#[cfg(target_os = "macos")]
async fn get_macos_devices() -> Result<Vec<Device>, String> {
    info!("Scanning for macOS devices...");
    let mut devices = Vec::new();
    
    // Use diskutil list to get connected devices
    let output = match Command::new("diskutil")
        .arg("list")
        .output() {
            Ok(output) => output,
            Err(e) => {
                error!("Failed to execute diskutil list: {}", e);
                return Err(format!("Failed to execute diskutil: {}", e));
            }
    };
    
    let output_str = String::from_utf8_lossy(&output.stdout);
    debug!("diskutil list output:\n{}", output_str);
    
    for line in output_str.lines() {
        if line.contains("/dev/disk") {
            debug!("Processing disk: {}", line);
            // Get additional info about the device
            let device_id = line.split_whitespace().next().unwrap_or("");
            info!("Getting info for device: {}", device_id);
            
            let info_output = match Command::new("diskutil")
                .args(["info", device_id])
                .output() {
                    Ok(output) => output,
                    Err(e) => {
                        error!("Failed to get info for device {}: {}", device_id, e);
                        continue;
                    }
            };
            
            let info_str = String::from_utf8_lossy(&info_output.stdout);
            debug!("Device info for {}:\n{}", device_id, info_str);
            
            let removable = info_str.contains("Removable Media: Yes");
            let mount_point = info_str.lines()
                .find(|l| l.contains("Mount Point:"))
                .and_then(|l| l.split(':').nth(1))
                .map(|s| s.trim());
            
            debug!("Found mount point: {:?}, removable: {}", mount_point, removable);
            
            if let Some(mount_point) = mount_point {
                if !mount_point.is_empty() {
                    info!("Adding device: {} at {}", device_id, mount_point);
                    devices.push(Device {
                        name: mount_point.split('/').last()
                            .unwrap_or(mount_point)
                            .to_string(),
                        path: mount_point.to_string(),
                        device_type: if removable { "removable".to_string() } 
                                    else { "fixed".to_string() },
                        removable,
                    });
                }
            }
        }
    }
    
    info!("Found {} devices", devices.len());
    debug!("Devices: {:?}", devices);
    
    Ok(devices)
}

#[tauri::command]
pub async fn watch_devices(app: AppHandle) -> Result<(), String> {
    info!("Starting device watcher");
    let (tx, rx) = channel();
    
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => {
                debug!("Device change event detected: {:?}", event);
                let _ = tx.send(());
            }
            Err(e) => error!("Watch error: {}", e),
        }
    }).map_err(|e| format!("Failed to create watcher: {}", e))?;
    
    #[cfg(target_os = "macos")]
    {
        info!("Setting up macOS volume watcher");
        watcher.watch(Path::new("/Volumes"), RecursiveMode::NonRecursive)
            .map_err(|e| {
                error!("Failed to watch /Volumes: {}", e);
                format!("Failed to watch volumes: {}", e)
            })?;
    }
    
    // Spawn a thread to handle device changes
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        loop {
            if rx.recv_timeout(Duration::from_secs(1)).is_ok() {
                info!("Device change detected, updating device list");
                if let Ok(devices) = rt.block_on(get_connected_devices()) {
                    debug!("Emitting devices-changed event with devices: {:?}", devices);
                    if let Err(e) = app.emit("devices-changed", devices) {
                        error!("Failed to emit devices-changed event: {}", e);
                    }
                }
            }
        }
    });
    
    Ok(())
}

#[tauri::command]
pub async fn read_device_dir(device_path: String, relative_path: Option<String>) -> Result<Vec<FileItem>, String> {
    let base_path = Path::new(&device_path);
    
    // If relative_path is provided, append it to the base device path
    let full_path = if let Some(rel_path) = relative_path {
        base_path.join(rel_path)
    } else {
        base_path.to_path_buf()
    };

    info!("Reading device directory: {}", full_path.display());
    
    if !full_path.exists() {
        return Err(format!("Path does not exist: {}", full_path.display()));
    }

    let mut entries = Vec::new();
    
    let read_dir = match std::fs::read_dir(&full_path) {
        Ok(dir) => dir,
        Err(e) => {
            error!("Failed to read directory {}: {}", full_path.display(), e);
            return Err(format!("Failed to read directory: {}", e));
        }
    };

    for entry in read_dir {
        if let Ok(entry) = entry {
            let path_str = entry.path().to_string_lossy().to_string();
            
            match entry.metadata() {
                Ok(metadata) => {
                    // Handle the name differently based on whether it's a file or directory
                    let name = entry.file_name().to_string_lossy().to_string();
                    
                    // Check if it's an audio file
                    let is_audio = if !metadata.is_dir() {
                        matches!(
                            entry.path().extension().and_then(|ext| ext.to_str()),
                            Some("mp3" | "flac" | "wav" | "m4a" | "aac" | "ogg" | "aiff")
                        )
                    } else {
                        false
                    };

                    entries.push(FileItem {
                        name,
                        path: path_str,
                        is_dir: metadata.is_dir(),
                        is_audio,
                    });
                }
                Err(e) => {
                    error!("Failed to read metadata for {}: {}", path_str, e);
                    continue;
                }
            }
        }
    }

    // Sort directories first, then files alphabetically
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    debug!("Found {} entries in device directory", entries.len());
    Ok(entries)
}
