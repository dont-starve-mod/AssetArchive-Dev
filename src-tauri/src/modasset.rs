use std::path::{Path, PathBuf};
use std::io::{Cursor, Read, Seek, SeekFrom};
use std::collections::{HashSet, HashMap};
use std::sync::Mutex;
use tauri::{Manager, Emitter, WebviewUrl, WebviewWindowBuilder};
use uuid::Uuid;
use once_cell::sync::Lazy;
use json::{JsonValue, object};
use crate::fastindex;

#[derive(Debug, Default, Clone)]
struct LoadingResult {
    path: String,
    success: bool,
    error: Option<String>,
    build: Option<String>,
    anim_list_len: usize,
}

impl LoadingResult {
    pub fn to_json(&self) -> JsonValue {
        object! {
            path: self.path.clone(),
            success: self.success,
            error: self.error.clone(),
            build: self.build.clone(),
            anim_list_len: self.anim_list_len,
        }
    }
}

#[tauri::command(rename_all = "snake_case")]
pub async fn add_mod_anim_files_checked(handle: tauri::AppHandle, path_list: Vec<String>) -> Result<Vec<String>, String> {
    let mut loading_result_list = vec![];
    for path in path_list {
        let syspath = PathBuf::from(path.clone());
        if !syspath.exists() {
            loading_result_list.push(LoadingResult {
                path,
                success: false,
                error: Some("File not exists".to_string()),
                ..Default::default()
            });
            continue;
        }
        if !syspath.is_file() {
            loading_result_list.push(LoadingResult {
                path,
                success: false,
                error: Some("Not a file".to_string()),
                ..Default::default()
            });
            continue;
        }
        let mut f = match std::fs::File::open(&syspath) {
            Ok(f) => f,
            Err(e) => {
                loading_result_list.push(LoadingResult {
                    path,
                    success: false,
                    error: Some(format!("Failed to open file: {}", e)),
                    ..Default::default()
                });
                continue;
            }
        };
        if path.ends_with(".zip") {
            match fastindex::load_anim_zip(f) {
                Ok((anim_index, build_index, _))=> {
                    loading_result_list.push(LoadingResult {
                        path,
                        success: true,
                        error: None,
                        build: build_index.map(|(v, _, _)| v),
                        anim_list_len: anim_index.unwrap_or_default().len(),
                    });
                },
                Err(e)=> {
                    loading_result_list.push(LoadingResult {
                        path,
                        success: false,
                        error: Some(format!("Failed to load zip file: {}", e)),
                        ..Default::default()
                    });
                }
            }
        }
        else if path.ends_with(".bin") {
            let mut sig = [0; 4];
            f.read_exact(&mut sig).ok();
            f.seek(SeekFrom::Start(0)).ok();
            if &sig == b"ANIM" {
                match fastindex::index_anim_bin(f) {
                    Ok((anim_list, _))=> {
                        loading_result_list.push(LoadingResult {
                            path,
                            success: true,
                            error: None,
                            build: None,
                            anim_list_len: anim_list.len(),
                        });
                    },
                    Err(e)=> {
                        loading_result_list.push(LoadingResult {
                            path,
                            success: false,
                            error: Some(format!("Failed to load anim file: {}", e)),
                            ..Default::default()
                        });
                        continue;
                    }
                }
            }
            else if &sig == b"BILD" {
                match fastindex::index_build_bin(f) {
                    Ok(((build_name, _, _), _))=> {
                        loading_result_list.push(LoadingResult {
                            path,
                            success: true,
                            error: None,
                            build: Some(build_name),
                            anim_list_len: 0,
                        });
                    },
                    Err(e)=> {
                        loading_result_list.push(LoadingResult {
                            path,
                            success: false,
                            error: Some(format!("Failed to load build file: {}", e)),
                            ..Default::default()
                        });
                        continue;
                    }
                }
            }
            else {
                loading_result_list.push(LoadingResult {
                    path,
                    success: false,
                    error: Some("Invalid anim/build file".to_string()),
                    ..Default::default()
                });
                continue;
            }
        }
        else {
            loading_result_list.push(LoadingResult {
                path,
                success: false,
                error: Some("Invalid file type".to_string()),
                ..Default::default()
            });
            continue;
        }
    }
    let success_list = loading_result_list.iter()
        .filter(|r| r.success)
        .map(|r| r.path.clone()).collect::<Vec<String>>();
    add_mod_anim_files(handle, success_list).await?;
    Ok(loading_result_list.iter()
        .map(|r| json::stringify(r.to_json()))
        .collect::<Vec<String>>())
}

const RECENT_FILES_STORE_PATH: &str = "mod_anim_asset_files-v0.json";

fn to_string_list(content: &str) -> Vec<String> {
    if let Ok(obj) = json::parse(content) {
        if let json::JsonValue::Array(arr) = obj {
            return arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect::<Vec<String>>();
        }
    }
    return vec![];
}

pub async fn add_mod_anim_files(handle: tauri::AppHandle, path_list: Vec<String>) -> Result<Vec<String>, String> {
    let store_path = handle.path().app_data_dir().unwrap().join(RECENT_FILES_STORE_PATH);
    let mut old_path_list = match std::fs::read_to_string(&store_path) {
        Ok(content) => to_string_list(&content),
        Err(_) => vec![],
    };
    if path_list.is_empty() {
        track_files(&handle, &old_path_list);
        return Ok(old_path_list);
    }
    else {
        for path in &path_list {
            // push file changed event here
            // filewatcher doesn't know who is NEW when adding files
            handle.emit("mod_file_changed", path).ok();
        }
    }
    // convert to set
    let path_set = path_list.iter().cloned().collect::<HashSet<String>>();
    let mut new_path_list = path_list.clone();
    old_path_list.iter().for_each(|path| {
        if !path_set.contains(path) {
            new_path_list.push(path.clone());
        }
    });
    let s = json::stringify(new_path_list.clone());
    std::fs::write(&store_path, s).map_err(|e| format!("Failed to write recent files: {}", e))?;
    track_files(&handle, &new_path_list);
    Ok(new_path_list)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn remove_mod_anim_files(handle: tauri::AppHandle, path_list: Vec<String>) -> Result<Vec<String>, String> {
    let store_path = handle.path().app_data_dir().unwrap().join(RECENT_FILES_STORE_PATH);
    let mut old_path_list = match std::fs::read_to_string(&store_path) {
        Ok(content) => to_string_list(&content),
        Err(_) => vec![],
    };
    if path_list.is_empty() {
        track_files(&handle, &old_path_list);
        return Ok(old_path_list);
    }
    if path_list[0] == "*" {
        // remove all
        let s = "[]";
        std::fs::write(&store_path, s).map_err(|e| format!("Failed to write recent files: {}", e))?;
        return Ok(vec![]);
    }
    let path_set = path_list.iter().cloned().collect::<HashSet<String>>();
    let mut new_path_list = vec![];
    old_path_list.iter().for_each(|path| {
        if !path_set.contains(path) {
            new_path_list.push(path.clone());
        }
    });
    let s = json::stringify(new_path_list.clone());
    std::fs::write(&store_path, s).map_err(|e| format!("Failed to write recent files: {}", e))?;
    track_files(&handle, &new_path_list);
    Ok(new_path_list)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn init_mod_anim_files_data(handle: tauri::AppHandle) -> Result<bool, String> {
    match remove_mod_anim_files(handle.clone(), vec![]).await {
        Ok(list)=> {
            match crate::lua_call(handle.clone(), "load_mod_anim_assets".to_string(), json::stringify(list)) {
                Ok(s)=> Ok(true),
                Err(e)=> Err(e),
            }
        },
        Err(e)=> Err(e),
    }
}

fn track_files(handle: &tauri::AppHandle, path_list: &Vec<String>) {
    for path in path_list {
        let syspath = Path::new(path);
        crate::filewatcher::watch(handle, syspath)
    }
}

// fn get_mtime(path: &str) -> f64 {
//     match std::fs::metadata(&path) {
//         Ok(meta) => {
//             if let Ok(time) = meta.modified() {
//                 if let Ok(time) = time.duration_since(std::time::UNIX_EPOCH) {
//                     return time.as_secs_f64();
//                 }
//             }
//         }
//         Err(_) => {}
//     }
//     -1.0
// }

// pub fn init_mod_asset_tracker(handle: tauri::AppHandle) {
//     use tauri::Emitter;
//     std::thread::spawn(move || {
//         loop {
//             std::thread::sleep(std::time::Duration::from_secs(1));
//             let mut tracker = FILES_TRACKER.lock().unwrap();
//             let mut changed_files = vec![];
//             for (path, time) in tracker.iter_mut() {
//                 let new_time = get_mtime(path);
//                 if new_time > 0.0 && new_time != *time {
//                     log::info!("Mod asset changed: {}", path);
//                     *time = new_time;
//                     changed_files.push(path.clone());
//                 }
//             }
//             if !changed_files.is_empty() {
//                 match crate::lua_call(handle.clone(), "load_mod_anim_assets".to_string(), json::stringify(changed_files)) {
//                     Ok(s)=> (),
//                     Err(e)=> { handle.emit("runtime_error", e).ok(); },
//                 };
//             }
//         }
//     });
// }