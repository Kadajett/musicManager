use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use parking_lot::Mutex;
use once_cell::sync::Lazy;
use std::sync::Arc;
use rodio::Sink;
use rodio::OutputStream;
use std::time::Duration;

pub mod commands;
pub mod metadata;
pub mod config;
pub mod transfer;
pub mod device;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_audio: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub favorite_locations: Vec<String>,
    pub recent_locations: Vec<String>,
    pub default_location: Option<String>,
    pub max_recent_locations: usize,
}

pub fn load_config() -> AppConfig {
    let config_path = get_config_path();
    match fs::read_to_string(&config_path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let config_path = get_config_path();
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(config_path, json).map_err(|e| e.to_string())
}

fn get_config_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("your_app_name");
    fs::create_dir_all(&path).unwrap_or_default();
    path.push("config.json");
    path
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            favorite_locations: Vec::new(),
            recent_locations: Vec::new(),
            default_location: None,
            max_recent_locations: 10,
        }
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Add this struct for minimal player state
pub struct PlayerState {
    pub current_path: Option<String>,
    pub is_playing: bool,
    pub stream: Option<(OutputStream, Arc<Sink>)>,
    pub duration: Option<Duration>,
    pub volume: f32,
}

// Implement Send and Sync explicitly
unsafe impl Send for PlayerState {}
unsafe impl Sync for PlayerState {}

pub static PLAYER: Lazy<Mutex<PlayerState>> = Lazy::new(|| {
    Mutex::new(PlayerState {
        current_path: None,
        is_playing: false,
        stream: None,
        duration: None,
        volume: 1.0,
    })
});

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_dir,
            commands::home_dir,
            commands::add_favorite_location,
            commands::remove_favorite_location,
            commands::get_favorite_locations,
            commands::set_default_location,
            commands::get_default_location,
            commands::add_recent_location,
            commands::get_recent_locations,
            commands::play_audio,
            commands::pause_audio,
            commands::resume_audio,
            commands::stop_audio,
            commands::set_volume,
            commands::get_track_position,
            commands::get_track_duration,
            commands::get_playback_speed,
            commands::set_playback_speed,
            commands::skip_track,
            commands::clear_queue,
            commands::is_queue_empty,
            commands::queue_length,
            commands::seek_to,
            metadata::get_audio_metadata,
            metadata::write_audio_metadata,
            metadata::combine_folders,
            metadata::get_artists_in_directory,
            metadata::get_album_art,
            commands::get_app_config,
            commands::update_app_config,
            metadata::get_metadata_for_directory,
            commands::get_recursive_audio_files,
            commands::move_file,
            commands::combine_files,
            commands::change_file_folder_name,
            commands::restore_file_extension,
            device::get_connected_devices,
            device::watch_devices,
            device::read_device_dir,
            transfer::verify_transfer,
            transfer::calculate_directory_checksum,
            transfer::transfer_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

