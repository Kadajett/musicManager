use rodio::{Decoder, OutputStream, Sink, Source};
use std::fs::File;
use std::path::Path;
use std::fs;
use std::io::BufReader;
use std::path::PathBuf;
use crate::{FileItem, load_config, save_config, PLAYER};
use std::sync::Arc;
use parking_lot::Mutex;
use lazy_static::lazy_static;
use std::time::Duration;
use crate::config::{load_player_config, save_player_config, AppConfig};
use std::collections::VecDeque;
use std::io::Read;
use lofty::{
    config::WriteOptions,
    prelude::{AudioFile, TaggedFileExt},
    probe::Probe,
    tag::{Tag, TagType, Accessor, ItemKey},
};
use crate::metadata::{MetadataWriteOptions, write_audio_metadata};

lazy_static! {
    static ref CURRENT_SINK: Mutex<Option<Arc<Sink>>> = Mutex::new(None);
}

#[tauri::command]
pub async fn change_file_folder_name(path: String, new_folder_name: String) -> Result<(), String> {
    println!("Changing file folder name: {} to {}", path, new_folder_name);
    let path = Path::new(&path);
    
    // Get the parent directory
    let parent_dir = path.parent()
        .ok_or_else(|| "Could not get parent directory".to_string())?;
    
    // If it's a file, preserve the extension
    let new_name = if path.is_file() {
        let extension = path.extension()
            .and_then(|ext| ext.to_str())
            .ok_or_else(|| "Could not get file extension".to_string())?;
        
        // If the new name already has the correct extension, use it as is
        if new_folder_name.ends_with(&format!(".{}", extension)) {
            new_folder_name
        } else {
            // Otherwise, append the original extension
            format!("{}.{}", new_folder_name, extension)
        }
    } else {
        new_folder_name
    };
    
    // Create the new path by joining the parent directory with the new name
    let new_folder_path = parent_dir.join(&new_name);
    
    println!("New folder path: {}", new_folder_path.to_string_lossy());
    println!("Original path: {}", path.to_string_lossy());
    
    fs::rename(path, new_folder_path)
        .map_err(|e| format!("Failed to rename file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn move_file(source_path: String, target_path: String) -> Result<(), String> {
    let source = Path::new(&source_path);
    let target = Path::new(&target_path);

    if !source.exists() {
        return Err("Source file does not exist".to_string());
    }

    if !target.is_dir() {
        return Err("Target must be a directory".to_string());
    }

    let file_name = source.file_name()
        .ok_or_else(|| "Invalid source file name".to_string())?;
    
    let target_file = target.join(file_name);

    fs::rename(source, target_file)
        .map_err(|e| format!("Failed to move file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn combine_files(
    source_path: String,
    target_path: String,
    new_folder_name: String,
    parent_path: String
) -> Result<(), String> {
    let parent = Path::new(&parent_path);
    let source = Path::new(&source_path);
    let target = Path::new(&target_path);

    if !source.exists() || !target.exists() {
        return Err("Source or target file does not exist".to_string());
    }

    // Create new folder
    let new_folder_path = parent.join(&new_folder_name);
    fs::create_dir(&new_folder_path)
        .map_err(|e| format!("Failed to create folder: {}", e))?;

    // Move both files into the new folder
    let source_name = source.file_name()
        .ok_or_else(|| "Invalid source file name".to_string())?;
    let target_name = target.file_name()
        .ok_or_else(|| "Invalid target file name".to_string())?;

    fs::rename(source, new_folder_path.join(source_name))
        .map_err(|e| format!("Failed to move source file: {}", e))?;
    fs::rename(target, new_folder_path.join(target_name))
        .map_err(|e| format!("Failed to move target file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn read_dir(path: String) -> Result<Vec<FileItem>, String> {
    let path = PathBuf::from(path);
    let mut entries = Vec::new();

    let read_dir = match std::fs::read_dir(&path) {
        Ok(dir) => dir,
        Err(e) => return Err(e.to_string()),
    };

    for entry in read_dir {
        if let Ok(entry) = entry {
            let path_str = entry.path().to_string_lossy().to_string();
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            
            // Handle the name differently based on whether it's a file or directory
            let name = entry.file_name().to_string_lossy().to_string();

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
    }

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[tauri::command]
pub fn home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|path| path.to_string_lossy().to_string())
        .ok_or_else(|| "Could not find home directory".to_string())
}

#[tauri::command]
pub fn add_favorite_location(path: String) -> Result<Vec<String>, String> {
    let mut config = load_config();
    if !config.favorite_locations.contains(&path) {
        config.favorite_locations.push(path);
        save_config(&config)?;
    }
    Ok(config.favorite_locations)
}

#[tauri::command]
pub fn remove_favorite_location(path: String) -> Result<Vec<String>, String> {
    let mut config = load_config();
    config.favorite_locations.retain(|x| x != &path);
    save_config(&config)?;
    Ok(config.favorite_locations)
}

#[tauri::command]
pub fn get_favorite_locations() -> Result<Vec<String>, String> {
    Ok(load_config().favorite_locations)
}

#[tauri::command]
pub fn set_default_location(path: String) -> Result<(), String> {
    let mut config = load_config();
    config.default_location = Some(path);
    save_config(&config)
}

#[tauri::command]
pub fn get_default_location() -> Option<String> {
    load_config().default_location
}

#[tauri::command]
pub fn add_recent_location(path: String) -> Result<Vec<String>, String> {
    let mut config = load_config();
    if let Some(pos) = config.recent_locations.iter().position(|x| x == &path) {
        config.recent_locations.remove(pos);
    }
    config.recent_locations.insert(0, path);

    if config.recent_locations.len() > config.max_recent_locations {
        config.recent_locations.truncate(config.max_recent_locations);
    }

    save_config(&config)?;
    Ok(config.recent_locations)
}

#[tauri::command]
pub fn get_recent_locations() -> Result<Vec<String>, String> {
    Ok(load_config().recent_locations)
}

#[tauri::command]
pub fn play_audio(path: &str) -> Result<(), String> {
    let mut player = PLAYER.lock();
    
    // Create new stream and sink
    let (stream, handle) = OutputStream::try_default()
        .map_err(|e| e.to_string())?;
    let sink = Sink::try_new(&handle)
        .map_err(|e| e.to_string())?;
    
    // Set the volume to the current volume level before playing
    sink.set_volume(player.volume);
    
    // Load and play the file
    let file = BufReader::new(File::open(path).map_err(|e| e.to_string())?);
    let source = Decoder::new(file).map_err(|e| e.to_string())?;
    
    // Get duration before consuming the source
    let duration = source.total_duration();
    
    sink.append(source);
    player.stream = Some((stream, Arc::new(sink)));
    player.current_path = Some(path.to_string());
    player.is_playing = true;
    player.duration = duration;  // Store the duration
    
    Ok(())
}

#[tauri::command]
pub fn pause_audio() -> Result<(), String> {
    let mut player = PLAYER.lock();
    if let Some((_, sink)) = &player.stream {
        sink.pause();
    }
    player.is_playing = false;
    Ok(())
}

#[tauri::command]
pub fn resume_audio() -> Result<(), String> {
    let mut player = PLAYER.lock();
    if let Some((_, sink)) = &player.stream {
        sink.play();
    }
    player.is_playing = true;
    Ok(())
}

#[tauri::command]
pub fn stop_audio() -> Result<(), String> {
    let mut player = PLAYER.lock();
    if let Some((_, sink)) = &player.stream {
        sink.stop();
        player.current_path = None;
    }
    player.is_playing = false;
    Ok(())
}

#[tauri::command]
pub fn set_volume(volume: f32) -> Result<(), String> {
    let mut player = PLAYER.lock();
    player.volume = volume;
    
    if let Some((_, sink)) = &player.stream {
        sink.set_volume(volume);
    }
    
    Ok(())
}

#[tauri::command]
pub fn get_current_track() -> Option<String> {
    PLAYER.lock().current_path.clone()
}

#[tauri::command]
pub fn get_track_position() -> f32 {
    let player = PLAYER.lock();
    // println!("Getting track position...");
    if let Some((_, sink)) = &player.stream {
        let position = sink.get_pos().as_secs_f32();
        // println!("Current track position: {} seconds", position);
        position
    } else {
        // println!("No active stream found, returning 0.0");
        0.0
    }
}

#[tauri::command]
pub fn get_track_duration() -> f32 {
    let player = PLAYER.lock();
    player.duration.map(|d| d.as_secs_f32()).unwrap_or(0.0)
}

#[tauri::command]
pub fn get_playback_speed() -> f32 {
    let player = PLAYER.lock();
    if let Some((_, sink)) = &player.stream {
        sink.speed()
    } else {
        1.0
    }
}

#[tauri::command]
pub fn set_playback_speed(speed: f32) -> Result<(), String> {
    let player = PLAYER.lock();
    if let Some((_, sink)) = &player.stream {
        sink.set_speed(speed);
    }
    Ok(())
}

#[tauri::command]
pub fn skip_track() -> Result<(), String> {
    let player = PLAYER.lock();
    if let Some((_, sink)) = &player.stream {
        sink.skip_one();
    }
    Ok(())
}

#[tauri::command]
pub fn clear_queue() -> Result<(), String> {
    let player = PLAYER.lock();
    if let Some((_, sink)) = &player.stream {
        sink.clear();
    }
    Ok(())
}

#[tauri::command]
pub fn is_queue_empty() -> bool {
    let player = PLAYER.lock();
    if let Some((_, sink)) = &player.stream {
        sink.empty()
    } else {
        true
    }
}

#[tauri::command]
pub fn queue_length() -> usize {
    let player = PLAYER.lock();
    if let Some((_, sink)) = &player.stream {
        sink.len()
    } else {
        0
    }
}

#[tauri::command]
pub fn seek_to(position: f32) -> Result<(), String> {
    let player = PLAYER.lock();
    if let Some((_, sink)) = &player.stream {
        let target = Duration::from_secs_f32(position);
        sink.try_seek(target).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|path| path.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

#[tauri::command]
pub fn get_app_config() -> Result<AppConfig, String> {
    Ok(load_player_config())
}

#[tauri::command]
pub fn update_app_config(config: AppConfig) -> Result<(), String> {
    save_player_config(&config)
}

#[tauri::command]
pub fn get_recursive_audio_files(path: &str) -> Result<Vec<FileItem>, String> {
    let mut audio_files = Vec::new();
    let mut dirs_to_process = VecDeque::new();
    dirs_to_process.push_back(PathBuf::from(path));

    while let Some(current_dir) = dirs_to_process.pop_front() {
        if let Ok(entries) = fs::read_dir(&current_dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.is_dir() {
                        dirs_to_process.push_back(path);
                    } else if let Some(extension) = path.extension() {
                        if let Some(ext_str) = extension.to_str() {
                            if ["mp3", "flac", "m4a", "wav", "ogg"].contains(&ext_str.to_lowercase().as_str()) {
                                let path_str = path.to_string_lossy().to_string();
                                audio_files.push(FileItem {
                                    name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                                    path: path_str,
                                    is_dir: false,
                                    is_audio: true,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(audio_files)
}

#[tauri::command]
pub async fn restore_file_extension(path: String) -> Result<(), String> {
    let path = Path::new(&path);
    restore_single_file_extension(path)
}

#[tauri::command]
pub async fn restore_folder_extensions(folder_path: String) -> Result<Vec<String>, String> {
    let path = Path::new(&folder_path);
    if !path.is_dir() {
        return Err("Path must be a directory".to_string());
    }

    let mut processed_files = Vec::new();
    let mut errors = Vec::new();

    for entry in fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))? {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                match restore_single_file_extension(&path) {
                    Ok(()) => processed_files.push(path.to_string_lossy().to_string()),
                    Err(e) => errors.push(format!("{}: {}", path.to_string_lossy(), e)),
                }
            }
        }
    }

    if !errors.is_empty() {
        eprintln!("Errors during batch processing:\n{}", errors.join("\n"));
    }

    Ok(processed_files)
}

fn restore_single_file_extension(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    if path.is_dir() {
        return Err("Cannot restore extension for directories".to_string());
    }

    // Read first few bytes to detect file type
    let mut file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut buffer = [0; 16];
    file.read(&mut buffer).map_err(|e| format!("Failed to read file: {}", e))?;

    // Detect file type based on magic numbers and get MIME type
    let (extension, mime_type) = if buffer.starts_with(b"\x00\x00\x00\x20\x66\x74\x79\x70") || // MP4
                      buffer.starts_with(b"\x00\x00\x00\x18\x66\x74\x79\x70") {
        ("mp4", "video/mp4")
    } else if buffer.starts_with(b"ID3") || buffer.starts_with(b"\xFF\xFB") { // MP3
        ("mp3", "audio/mpeg")
    } else if buffer.starts_with(b"fLaC") { // FLAC
        ("flac", "audio/flac")
    } else if buffer.starts_with(b"OggS") { // OGG
        ("ogg", "audio/ogg")
    } else if buffer.starts_with(b"RIFF") { // WAV
        ("wav", "audio/wav")
    } else {
        return Err("Could not detect file type".to_string());
    };

    // Get the filename without any existing extension
    let filename = path.file_name()
        .ok_or_else(|| "Could not get filename".to_string())?
        .to_str()
        .ok_or_else(|| "Invalid filename".to_string())?;

    let new_name = if filename.contains('.') {
        // Replace existing extension
        let base = filename.split('.').next()
            .ok_or_else(|| "Could not get base filename".to_string())?;
        format!("{}.{}", base, extension)
    } else {
        // Add extension if none exists
        format!("{}.{}", filename, extension)
    };

    let new_path = path.with_file_name(&new_name);
    
    // Rename the file
    fs::rename(path, &new_path).map_err(|e| format!("Failed to rename file: {}", e))?;

    // Update the metadata
    let options = MetadataWriteOptions {
        path: new_path.to_string_lossy().to_string(),
        title: Some(filename.to_string()),
        artist: None,
        album: None,
        album_artist: None,
        album_art: None,
        genre: None,
        year: None,
        track_number: None,
    };

    // Try to write metadata, but don't fail if it doesn't work
    if let Err(e) = write_audio_metadata(options) {
        eprintln!("Warning: Failed to update metadata: {}", e);
    }

    Ok(())
}
 