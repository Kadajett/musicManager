use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::io::{self, Read};
use sha2::{Sha256, Digest};
use tar::Builder;
use log::info;
use flate2::write::GzEncoder;
use flate2::read::GzDecoder;
use flate2::Compression;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileChecksum {
    pub path: String,
    pub checksum: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransferManifest {
    pub checksums: Vec<FileChecksum>,
    pub total_size: u64,
    pub file_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransferOptions {
    pub source_path: String,
    pub target_path: String,
    pub create_archive: bool,
    pub verify_transfer: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct TransferResult {
    pub success: bool,
    pub message: String,
    pub transferred_files: usize,
    pub total_size: u64,
}

#[derive(Debug, Serialize, Clone)]
pub struct TransferProgress {
    pub status: String,
    pub current_file: Option<String>,
    pub processed_files: usize,
    pub total_files: usize,
    pub processed_size: u64,
    pub total_size: u64,
}

fn calculate_file_checksum(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 8192]; // 8KB buffer

    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn visit_dirs(dir: &Path, cb: &mut dyn FnMut(&Path)) -> io::Result<()> {
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                visit_dirs(&path, cb)?;
            } else {
                cb(&path);
            }
        }
    }
    Ok(())
}

fn create_archive(source_path: &Path, archive_path: &Path) -> io::Result<()> {
    let archive_file = File::create(archive_path)?;
    let encoder = GzEncoder::new(archive_file, Compression::default());
    let mut archive = Builder::new(encoder);

    visit_dirs(source_path, &mut |path| {
        if path.is_file() {
            if let Ok(relative_path) = path.strip_prefix(source_path) {
                let _ = archive.append_path_with_name(path, relative_path);
            }
        }
    })?;

    archive.finish()?;
    Ok(())
}

fn extract_archive(archive_path: &Path, target_path: &Path) -> io::Result<()> {
    let archive_file = File::open(archive_path)?;
    let decoder = GzDecoder::new(archive_file);
    let mut archive = tar::Archive::new(decoder);
    
    archive.unpack(target_path)?;
    Ok(())
}

#[tauri::command]
pub async fn calculate_directory_checksum(path: String) -> Result<TransferManifest, String> {
    let source_path = Path::new(&path);
    if !source_path.exists() {
        return Err("Source path does not exist".to_string());
    }

    let mut manifest = TransferManifest {
        checksums: Vec::new(),
        total_size: 0,
        file_count: 0,
    };

    visit_dirs(source_path, &mut |path| {
        if path.is_file() {
            if let Ok(checksum) = calculate_file_checksum(path) {
                if let Ok(metadata) = fs::metadata(path) {
                    manifest.total_size += metadata.len();
                    manifest.file_count += 1;

                    if let Ok(relative_path) = path.strip_prefix(source_path) {
                        manifest.checksums.push(FileChecksum {
                            path: relative_path.to_string_lossy().into_owned(),
                            checksum,
                        });
                    }
                }
            }
        }
    }).map_err(|e| format!("Failed to walk directory: {}", e))?;

    Ok(manifest)
}

#[tauri::command]
pub async fn verify_transfer(path: String, original_manifest: TransferManifest) -> Result<TransferResult, String> {
    let target_path = Path::new(&path);
    if !target_path.exists() {
        return Err("Target path does not exist".to_string());
    }

    let mut mismatches = Vec::new();
    let mut verified_size = 0;
    let mut verified_files = 0;

    for original_file in &original_manifest.checksums {
        let target_file_path = target_path.join(&original_file.path);
        if !target_file_path.exists() {
            mismatches.push(format!("Missing file: {}", original_file.path));
            continue;
        }

        let new_checksum = calculate_file_checksum(&target_file_path)
            .map_err(|e| format!("Failed to calculate checksum: {}", e))?;

        if new_checksum != original_file.checksum {
            mismatches.push(format!("Checksum mismatch for: {}", original_file.path));
        } else if let Ok(metadata) = fs::metadata(&target_file_path) {
            verified_size += metadata.len();
            verified_files += 1;
        }
    }

    Ok(TransferResult {
        success: mismatches.is_empty(),
        message: if mismatches.is_empty() {
            format!("Successfully verified {} files", verified_files)
        } else {
            format!("Transfer verification failed:\n{}", mismatches.join("\n"))
        },
        transferred_files: verified_files,
        total_size: verified_size,
    })
}

#[tauri::command]
pub async fn transfer_files(app: AppHandle, options: TransferOptions) -> Result<TransferResult, String> {
    let source_path = PathBuf::from(&options.source_path);
    let target_path = PathBuf::from(&options.target_path);
    let temp_dir = std::env::temp_dir();
    let archive_path = temp_dir.join("transfer.tar.gz");

    // Step 1: Calculate initial checksums if verification is requested
    let manifest = if options.verify_transfer {
        app.emit("transfer-progress", TransferProgress {
            status: "Calculating checksums...".into(),
            current_file: None,
            processed_files: 0,
            total_files: 0,
            processed_size: 0,
            total_size: 0,
        }).ok();
        
        Some(calculate_directory_checksum(options.source_path.clone()).await?)
    } else {
        None
    };

    let total_files = manifest.as_ref().map(|m| m.file_count).unwrap_or(0);
    let total_size = manifest.as_ref().map(|m| m.total_size).unwrap_or(0);

    // Step 2: Create and transfer files
    if options.create_archive {
        // Archive method
        app.emit("transfer-progress", TransferProgress {
            status: "Creating archive...".into(),
            current_file: None,
            processed_files: 0,
            total_files,
            processed_size: 0,
            total_size,
        }).ok();

        create_archive(&source_path, &archive_path)
            .map_err(|e| format!("Failed to create archive: {}", e))?;

        info!("Transferring archive... {} {} {} {} {}", total_files, total_size, archive_path.to_string_lossy(), target_path.to_string_lossy(), options.target_path);
        app.emit("transfer-progress", TransferProgress {
            status: "Transferring archive...".into(),
            current_file: None,
            processed_files: total_files / 2,
            total_files,
            processed_size: total_size / 2,
            total_size,
        }).ok();

        fs::copy(&archive_path, target_path.join("transfer.tar.gz"))
            .map_err(|e| format!("Failed to transfer archive: {}", e))?;

        app.emit("transfer-progress", TransferProgress {
            status: "Extracting archive...".into(),
            current_file: None,
            processed_files: total_files * 3 / 4,
            total_files,
            processed_size: total_size * 3 / 4,
            total_size,
        }).ok();

        extract_archive(
            &target_path.join("transfer.tar.gz"),
            &target_path
        ).map_err(|e| format!("Failed to extract archive: {}", e))?;

        // Clean up temporary files
        let _ = fs::remove_file(&archive_path);
        let _ = fs::remove_file(target_path.join("transfer.tar.gz"));
    } else {
        // Direct copy method
        let mut copied_files = 0;
        let mut total_copied_size = 0;

        visit_dirs(&source_path, &mut |path| {
            if path.is_file() {
                if let Ok(relative_path) = path.strip_prefix(&source_path) {
                    let target_file = target_path.join(relative_path);
                    
                    app.emit("transfer-progress", TransferProgress {
                        status: "Copying files...".into(),
                        current_file: Some(relative_path.to_string_lossy().to_string()),
                        processed_files: copied_files,
                        total_files,
                        processed_size: total_copied_size,
                        total_size,
                    }).ok();

                    if let Some(parent) = target_file.parent() {
                        let _ = fs::create_dir_all(parent);
                    }

                    if let Ok(metadata) = fs::metadata(path) {
                        if fs::copy(path, target_file).is_ok() {
                            copied_files += 1;
                            total_copied_size += metadata.len();
                        }
                    }
                }
            }
        }).map_err(|e| format!("Failed to copy files: {}", e))?;

        if copied_files == 0 {
            return Err("No files were copied".to_string());
        }
    }

    // Final progress update
    app.emit("transfer-progress", TransferProgress {
        status: "Transfer complete".into(),
        current_file: None,
        processed_files: total_files,
        total_files,
        processed_size: total_size,
        total_size,
    }).ok();

    // Step 3: Verify transfer if requested
    if options.verify_transfer {
        if let Some(manifest) = manifest {
            let file_count = manifest.file_count;
            let total_size = manifest.total_size;
            return verify_transfer(options.target_path, manifest).await.map(|mut result| {
                if result.transferred_files == 0 {
                    result.transferred_files = file_count;
                    result.total_size = total_size;
                }
                result
            });
        }
    }

    Ok(TransferResult {
        success: true,
        message: "Transfer completed successfully".to_string(),
        transferred_files: manifest.clone().map_or(0, |m| m.file_count),
        total_size: manifest.clone().map_or(0, |m| m.total_size),
    })
}