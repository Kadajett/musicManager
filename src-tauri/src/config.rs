use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use directories::ProjectDirs;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub default_location: Option<String>,
    pub recent_locations: Vec<String>,
    pub favorite_locations: Vec<String>,
    pub max_recent_locations: usize,
    pub playback_settings: PlaybackSettings,
    pub view_settings: ViewSettings,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaybackSettings {
    pub volume: f32,
    pub repeat_mode: RepeatMode,
    pub shuffle: bool,
    pub crossfade: bool,
    pub crossfade_duration: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ViewSettings {
    pub show_artwork: bool,
    pub dark_mode: bool,
    pub sort_by: SortBy,
    pub group_by: GroupBy,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum RepeatMode {
    Off,
    Single,
    All,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum SortBy {
    Name,
    Artist,
    Album,
    DateAdded,
    DateModified,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum GroupBy {
    None,
    Artist,
    Album,
    Genre,
    Year,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            default_location: None,
            recent_locations: Vec::new(),
            favorite_locations: Vec::new(),
            max_recent_locations: 10,
            playback_settings: PlaybackSettings::default(),
            view_settings: ViewSettings::default(),
        }
    }
}

impl Default for PlaybackSettings {
    fn default() -> Self {
        Self {
            volume: 0.5,
            repeat_mode: RepeatMode::Off,
            shuffle: false,
            crossfade: false,
            crossfade_duration: 2.0,
        }
    }
}

impl Default for ViewSettings {
    fn default() -> Self {
        Self {
            show_artwork: true,
            dark_mode: false,
            sort_by: SortBy::Name,
            group_by: GroupBy::None,
        }
    }
}

pub fn get_config_dir() -> Option<PathBuf> {
    ProjectDirs::from("com", "your-org", "music-manager")
        .map(|proj_dirs| proj_dirs.config_dir().to_path_buf())
}

pub fn load_player_config() -> AppConfig {
    let config_dir = match get_config_dir() {
        Some(dir) => dir,
        None => return AppConfig::default(),
    };

    let config_path = config_dir.join("config.json");

    if !config_dir.exists() {
        let _ = fs::create_dir_all(&config_dir);
    }

    match fs::read_to_string(&config_path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

pub fn save_player_config(config: &AppConfig) -> Result<(), String> {
    let config_dir = get_config_dir().ok_or("Could not determine config directory")?;
    let config_path = config_dir.join("config.json");

    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(config_path, json).map_err(|e| e.to_string())?;
    
    Ok(())
} 