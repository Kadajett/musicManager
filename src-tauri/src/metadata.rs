use lofty::{
    config::WriteOptions, prelude::{AudioFile, ItemKey, TaggedFileExt}, probe::Probe, tag::{Accessor, Tag, TagType}, picture::PictureType, picture::MimeType, picture::Picture
};
use serde::Serialize;
use serde::Deserialize;
use std::path::Path;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
pub struct AudioMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub year: Option<u32>,
    pub track_number: Option<u32>,
    pub genre: Option<String>,
    pub album_art: Option<String>, // Base64 encoded image
    pub duration: Option<f64>,
    pub audio_bitrate: Option<u32>,
    pub overall_bitrate: Option<u32>,
    pub sample_rate: Option<u32>,
    pub bit_depth: Option<u32>,
    pub channels: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct MetadataWriteResult {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub fn get_audio_metadata(path: &str) -> Result<AudioMetadata, String> {
    let path = Path::new(path);
    let tagged_file = Probe::open(path)
        .map_err(|e| e.to_string())?
        .read()
        .map_err(|e| e.to_string())?;

    let tag = match tagged_file.primary_tag() {
        Some(primary_tag) => primary_tag,
        None => tagged_file.first_tag()
            .ok_or_else(|| "No tags found".to_string())?,
    };

    // Get the first picture (usually album art)
    let album_art = tag.pictures().first().map(|picture| {
        BASE64.encode(&picture.data())
    });

    let properties = tagged_file.properties();
    let duration = properties.duration().as_secs_f64();

    Ok(AudioMetadata {
        title: tag.title().map(|s| s.to_string()),
        artist: tag.artist().map(|s| s.to_string()),
        album: tag.album().map(|s| s.to_string()),
        album_artist: tag.get_string(&ItemKey::AlbumArtist).map(|s| s.to_string()),
        year: tag.year(),
        track_number: tag.track(),
        genre: tag.genre().map(|s| s.to_string()),
        album_art,
        duration: Some(duration),
        audio_bitrate: properties.audio_bitrate(),
        overall_bitrate: properties.overall_bitrate(),
        sample_rate: properties.sample_rate(),
        bit_depth: properties.bit_depth().map(|b| b as u32),
        channels: properties.channels().map(|c| c as u32),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MetadataWriteOptions {
    pub path: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub album_art: Option<String>,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub track_number: Option<u32>,
}

fn process_directory_metadata(dir_path: &Path, options: &MetadataWriteOptions) -> Result<(u32, u32), String> {
    let mut success_count = 0;
    let mut error_count = 0;

    for entry in fs::read_dir(dir_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            let (sub_success, sub_error) = process_directory_metadata(&path, options)?;
            success_count += sub_success;
            error_count += sub_error;
        } else if let Some(extension) = path.extension() {
            if let Some(ext_str) = extension.to_str() {
                if ["mp3", "flac", "m4a"].contains(&ext_str.to_lowercase().as_str()) {
                    // Create new options for each file with the same metadata
                    let file_options = MetadataWriteOptions {
                        path: path.to_string_lossy().to_string(),
                        title: None, // Don't change title for batch operations
                        artist: options.artist.clone(),
                        album: options.album.clone(),
                        album_artist: options.album_artist.clone(),
                        album_art: options.album_art.clone(),
                        genre: options.genre.clone(),
                        year: options.year,
                        track_number: None, // Don't change track numbers for batch operations
                    };

                    match write_single_file_metadata(&file_options) {
                        Ok(_) => success_count += 1,
                        Err(e) => {
                            error_count += 1;
                            eprintln!("Error writing metadata to {:?}: {}", path, e);
                        }
                    }
                }
            }
        }
    }

    Ok((success_count, error_count))
}

#[tauri::command]
pub fn write_audio_metadata(options: MetadataWriteOptions) -> Result<MetadataWriteResult, String> {
    let path = Path::new(&options.path);
    
    // If it's a directory, recursively process all audio files
    if path.is_dir() {
        let (success_count, error_count) = process_directory_metadata(path, &options)?;

        if error_count == 0 {
            Ok(MetadataWriteResult {
                success: true,
                message: format!("Successfully updated metadata for {} files", success_count),
            })
        } else {
            Ok(MetadataWriteResult {
                success: false,
                message: format!(
                    "Updated {} files, failed to update {} files. Check logs for details.",
                    success_count, error_count
                ),
            })
        }
    } else {
        // Single file case
        write_single_file_metadata(&options)
    }
}

fn write_single_file_metadata(options: &MetadataWriteOptions) -> Result<MetadataWriteResult, String> {
    let path = Path::new(&options.path);
    
    // Read the existing file
    let mut tagged_file = Probe::open(path)
        .map_err(|e| format!("Failed to open file: {}", e))?
        .read()
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Get the primary tag or create one if it doesn't exist
    let tag = match tagged_file.primary_tag_mut() {
        Some(primary_tag) => primary_tag,
        None => {
            if let Some(first_tag) = tagged_file.first_tag_mut() {
                first_tag
            } else {
                let tag_type = tagged_file.primary_tag_type();
                tagged_file.insert_tag(Tag::new(tag_type));
                tagged_file.primary_tag_mut()
                    .ok_or_else(|| "Failed to create new tag".to_string())?
            }
        },
    };

    // Only update fields that were provided in the options
    if let Some(artist) = &options.artist {
        tag.set_artist(artist.to_string());
    }
    if let Some(album_artist) = &options.album_artist {
        tag.insert_text(ItemKey::AlbumArtist, album_artist.to_string());
    }
    if let Some(album) = &options.album {
        tag.set_album(album.to_string());
    }
    if let Some(genre) = &options.genre {
        tag.set_genre(genre.to_string());
    }
    if let Some(year) = options.year {
        tag.set_year(year);
    }
    if let Some(title) = &options.title {
        tag.set_title(title.to_string());
    }
    if let Some(track) = options.track_number {
        tag.set_track(track);
    }

    // Save the changes
    tagged_file.save_to_path(path, WriteOptions::default())
        .map_err(|e| format!("Failed to save metadata: {}", e))?;

    Ok(MetadataWriteResult {
        success: true,
        message: "Metadata successfully updated".to_string(),
    })
}

#[tauri::command]
pub async fn set_album_art(path: &str, album_art: &str) -> Result<(), String> {
    let path = Path::new(path);
    let mut tagged_file = Probe::open(path)
        .map_err(|e| e.to_string())?
        .read()
        .map_err(|e| e.to_string())?;

    // Get the primary tag or create one if it doesn't exist
    let tag = match tagged_file.primary_tag_mut() {
        Some(primary_tag) => primary_tag,
        None => {
            if let Some(first_tag) = tagged_file.first_tag_mut() {
                first_tag
            } else {
                let tag_type = tagged_file.primary_tag_type();
                tagged_file.insert_tag(Tag::new(tag_type));
                tagged_file.primary_tag_mut()
                    .ok_or_else(|| "Failed to create new tag".to_string())?
            }
        },
    };

    // Decode base64 album art
    let image_data = BASE64.decode(album_art)
        .map_err(|e| format!("Failed to decode base64 image: {}", e))?;

    // Create a new picture with the image data
    let picture = Picture::new_unchecked(
        PictureType::CoverFront,
        Some(MimeType::Jpeg),
        None,
        image_data,
    );

    // Remove existing pictures and add the new one
    // tag.remove_picture();
    tag.push_picture(picture);

    // Save the changes
    tagged_file.save_to_path(path, WriteOptions::default())
        .map_err(|e| format!("Failed to save metadata: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_album_art(path: &str) -> Result<Option<String>, String> {
    let path = Path::new(path);
    let tagged_file = Probe::open(path)
        .map_err(|e| e.to_string())?
        .read()
        .map_err(|e| e.to_string())?;

    let tag = match tagged_file.primary_tag() {
        Some(primary_tag) => primary_tag,
        None => tagged_file.first_tag()
            .ok_or_else(|| "No tags found".to_string())?,
    };

    Ok(tag.pictures().first().map(|picture| {
        BASE64.encode(&picture.data())
    }))
}

#[derive(Debug, Serialize)]
pub struct ArtistInfo {
    pub name: String,
    pub track_count: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum SortOption {
    FileName,
    Title,
    TrackNumber,
}

#[tauri::command]
pub fn get_metadata_for_directory(path: &str, sort_by: Option<SortOption>) -> Result<Vec<AudioMetadata>, String> {
    let path = Path::new(path);
    let mut metadata_list = Vec::new();
    
    // If it's a single file, just get its metadata
    if path.is_file() {
        if let Ok(metadata) = get_audio_metadata(path.to_str().unwrap_or_default()) {
            metadata_list.push(metadata);
        }
        return Ok(metadata_list);
    }
    
    // Otherwise process directory
    let files = fs::read_dir(path).map_err(|e| e.to_string())?;
    
    for entry in files {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        
        // Check if the file has an audio extension
        if let Some(extension) = path.extension() {
            if let Some(ext_str) = extension.to_str() {
                if ["mp3", "flac", "m4a", "wav", "ogg"].contains(&ext_str.to_lowercase().as_str()) {
                    // Try to get metadata for the audio file
                    match get_audio_metadata(path.to_str().unwrap_or_default()) {
                        Ok(metadata) => {
                            metadata_list.push(metadata);
                        },
                        Err(e) => {
                            eprintln!("Error getting metadata for {:?}: {}", path, e);
                        }
                    }
                }
            }
        }
    }

    // Sort the metadata list based on the sort option
    if let Some(sort_option) = sort_by {
        metadata_list.sort_by(|a, b| {
            match sort_option {
                SortOption::FileName => {
                    Path::new(&a.title.as_ref().unwrap_or(&String::new()))
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .cmp(&Path::new(&b.title.as_ref().unwrap_or(&String::new()))
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or(""))
                },
                SortOption::Title => {
                    a.title.as_ref().unwrap_or(&String::new())
                        .cmp(&b.title.as_ref().unwrap_or(&String::new()))
                },
                SortOption::TrackNumber => {
                    a.track_number.unwrap_or(u32::MAX)
                        .cmp(&b.track_number.unwrap_or(u32::MAX))
                },
            }
        });
    }
    
    println!("Found {} files with metadata in {}", metadata_list.len(), path.display());
    Ok(metadata_list)
}

#[tauri::command]
pub fn get_artists_in_directory(path: &str) -> Result<Vec<ArtistInfo>, String> {
    let mut artist_counts: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    
    fn process_directory(dir_path: &Path, artist_counts: &mut std::collections::HashMap<String, u32>) -> Result<(), String> {
        for entry in fs::read_dir(dir_path).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            
            if path.is_dir() {
                process_directory(&path, artist_counts)?;
            } else if let Some(extension) = path.extension() {
                if let Some(ext_str) = extension.to_str() {
                    if ["mp3", "flac", "m4a", "wav", "ogg"].contains(&ext_str.to_lowercase().as_str()) {
                        if let Ok(tagged_file) = Probe::open(&path).and_then(|p| p.read()) {
                            if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
                                if let Some(artist) = tag.artist() {
                                    let count = artist_counts.entry(artist.to_string()).or_insert(0);
                                    *count += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }
    
    process_directory(Path::new(path), &mut artist_counts)?;
    
    let artists: Vec<ArtistInfo> = artist_counts
        .into_iter()
        .map(|(name, track_count)| ArtistInfo { name, track_count })
        .collect();
    
    Ok(artists)
}

#[tauri::command]
pub fn combine_folders(paths: Vec<String>, new_folder_name: String, parent_path: String) -> Result<(), String> {
    let parent = PathBuf::from(&parent_path);
    let new_folder_path = parent.join(&new_folder_name);

    // Create the new folder
    fs::create_dir(&new_folder_path)
        .map_err(|e| format!("Failed to create new folder: {}", e))?;

    // Move all selected folders/files into the new folder
    for path in paths {
        let source = PathBuf::from(&path);
        let file_name = source.file_name()
            .ok_or_else(|| "Invalid source path".to_string())?;
        let destination = new_folder_path.join(file_name);

        fs::rename(&source, &destination)
            .map_err(|e| format!("Failed to move {}: {}", path, e))?;
    }

    Ok(())
} 