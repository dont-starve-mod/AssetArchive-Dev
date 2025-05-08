use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use uuid::Uuid;
use std::path::{Path, PathBuf};
use std::io::{Cursor, Read};
use std::collections::HashSet;
#[cfg(unix)]
use std::os::fd::{RawFd, AsRawFd};
#[cfg(unix)]
use libc;
#[cfg(windows)]
use std::os::windows::io::{RawHandle, AsRawHandle, OwnedHandle, FromRawHandle};
#[cfg(windows)]
use std::os::raw::c_void;

#[cfg(unix)]
type FileDescriptor = RawFd;
#[cfg(windows)]
type FileDescriptor = usize;

fn path_to_label(path: &str) -> String {
    let uuid = Uuid::new_v5(&Uuid::NAMESPACE_URL, path.as_bytes())
        .as_braced()
        .to_string();
    format!("ql-{}", &uuid[1..uuid.len()-1])
}

fn pop_file_error_dialog(handle: tauri::AppHandle, msg: String) {
    use tauri_plugin_dialog::*;
    handle.dialog()
        .message(msg)
        .title("Error")
        .buttons(MessageDialogButtons::Ok)
        .kind(MessageDialogKind::Error)
        .show(|_|{});
}

#[tauri::command(rename_all = "snake_case")]
pub async fn open_quicklook_windows(handle: tauri::AppHandle, path_list: Vec<String>) -> Result<Vec<String>, String> {
    let mut success_path_list = vec![];
    for path in path_list {
        let label = path_to_label(&path);
        if let Some(sub_window) = handle.get_webview_window(&label) {
            sub_window.show();
            sub_window.set_focus();
            continue;
        }
        let syspath = PathBuf::from(path.clone());
        if !syspath.exists() {
            pop_file_error_dialog(handle.clone(), format!("文件不存在: {}", path));
            continue;
        }
        else if !syspath.is_file() {
            pop_file_error_dialog(handle.clone(), format!("不是一个文件: {}", path));
            continue;
        }
        else {
            let file_name = syspath.file_name().unwrap_or_default().to_string_lossy();
            WebviewWindowBuilder::new(&handle, label, WebviewUrl::App("/quick-look".into()))
                .title(file_name.to_string())
                .inner_size(800.0, 600.0)
                .min_inner_size(400.0, 300.0)
                .initialization_script(&format!(r#"
                    window.filepath = {};
                    window.filename = {};
                "#, 
                    serde_json::to_string(&path).unwrap(),
                    serde_json::to_string(&file_name.to_string()).unwrap()
                ))
                .build()
                .map_err(|e| format!("Failed to build webview: {}", e))?;
            success_path_list.push(path.clone());
        }
    }
    add_quicklook_recent_files(handle, success_path_list).await
}

const MAX_RECENT_FILES: usize = 50;
const RECENT_FILES_STORE_PATH: &str = "ql_recent_files-v0.json";

fn to_string_list(content: &str) -> Vec<String> {
    if let Ok(obj) = json::parse(content) {
        if let json::JsonValue::Array(arr) = obj {
            return arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect::<Vec<String>>();
        }
    }
    return vec![];
}

#[tauri::command]
pub async fn add_quicklook_recent_files(handle: tauri::AppHandle, path_list: Vec<String>) -> Result<Vec<String>, String> {
    let store_path = handle.path().app_data_dir().unwrap().join(RECENT_FILES_STORE_PATH);
    let mut old_path_list = match std::fs::read_to_string(&store_path) {
        Ok(content) => to_string_list(&content),
        Err(_) => vec![],
    };
    println!("old_path_list: {:?}", old_path_list);
    if path_list.is_empty() {
        return Ok(old_path_list);
    }
    // convert to set
    let path_set = path_list.iter().cloned().collect::<HashSet<String>>();
    let mut new_path_list = path_list.clone();
    old_path_list.iter().for_each(|path| {
        if !path_set.contains(path) {
            new_path_list.push(path.clone());
        }
    });
    new_path_list.truncate(MAX_RECENT_FILES);
    println!("new_path_list: {:?}", new_path_list);
    let s = json::stringify(new_path_list.clone());
    std::fs::write(&store_path, s).map_err(|e| format!("Failed to write recent files: {}", e))?;
    Ok(new_path_list)
}

pub mod lua_quicklook {
    use super::*;
    use std::fs::File;
    use rlua::prelude::*;
    use zip::ZipArchive;
    use zip::HasZipMetadata;

    enum ZipLoaderInner {
        File(ZipArchive<File>, FileDescriptor),
        Cursor(ZipArchive<Cursor<Vec<u8>>>),
        Closed,
    }

    impl LuaUserData for ZipLoaderInner {
        // fn add_methods<'lua, T: UserDataMethods<'lua, Self>>(_methods: &mut T) {
            
        // }
    }
    
    /// zip archive file loader in Rust
    /// TODO: replace Lua version (dyn loader might not..)
    struct ZipLoader {
        pub inner: ZipLoaderInner,
        pub raw_name_list: Vec<Vec<u8>>,
    }

    impl ZipLoader {
        fn open(path: String) -> Result<Self, String> {
            let mut f = std::fs::OpenOptions::new()
                .read(true)
                .open(path)
                .map_err(|e| format!("Failed to open file: {}", e))?;
            #[cfg(unix)]
            let fd = f.as_raw_fd();
            #[cfg(windows)]
            let fd = f.as_raw_handle() as usize;
            let mut zip = ZipArchive::new(f)
                .map_err(|e| format!("Failed to read as zip archive: {}", e))?;
            let mut raw_name_list = vec![];
            for i in 0..zip.len() {
                let file = zip.by_index(i).map_err(|e| format!("Failed to read zip archive: {}", e))?;
                if file.is_file() {
                    raw_name_list.push(file.name_raw().to_vec());
                }
            }
            Ok(ZipLoader {inner: ZipLoaderInner::File(zip, fd), raw_name_list})
        }

        fn wrap_bytes(bytes: &[u8]) -> Result<Self, String> {
            let mut f = Cursor::new(bytes.to_vec());
            let mut zip = ZipArchive::new(f)
                .map_err(|e| format!("Failed to read as zip archive: {}", e)).unwrap();
            let mut raw_name_list = vec![];
            for i in 0..zip.len() {
                let file = zip.by_index(i).map_err(|e| format!("Failed to read zip archive: {}", e)).unwrap();
                raw_name_list.push(file.name_raw().to_vec());
            }
            Ok(ZipLoader {inner: ZipLoaderInner::Cursor(zip), raw_name_list})
        }

        fn get_by_index(&mut self, index: usize) -> Result<Vec<u8>, String> {
            let mut buf = Vec::new();
            match &mut self.inner {
                ZipLoaderInner::File(zip, _) => {
                    zip.by_index(index).map_err(|e| format!("Failed to read zip archive: {}", e))?
                        .read_to_end(&mut buf).map_err(|e| format!("Failed to read zip archive: {}", e))?;
                },
                ZipLoaderInner::Cursor(zip) => {
                    zip.by_index(index).map_err(|e| format!("Failed to read zip archive: {}", e))?
                        .read_to_end(&mut buf).map_err(|e| format!("Failed to read zip archive: {}", e))?;
                },
                ZipLoaderInner::Closed => return Err("Zip archive is closed".to_string()),
            };
            Ok(buf)
        }

        fn get_metadata_by_index(&mut self, index: usize) -> Result<u32, String> {
            let mtime = match &mut self.inner {
                ZipLoaderInner::File(zip, _) => {
                    let file = zip.by_index(index).map_err(|e| format!("Failed to read zip archive: {}", e))?;
                    file.get_metadata().last_modified_time.unwrap_or_default()
                },
                ZipLoaderInner::Cursor(zip) => {
                    let file = zip.by_index(index).map_err(|e| format!("Failed to read zip archive: {}", e))?;
                    file.get_metadata().last_modified_time.unwrap_or_default()
                },
                ZipLoaderInner::Closed => return Err("Zip archive is closed".to_string()),
            };
            let t = mtime.datepart() as u32 * 65536_u32 + mtime.timepart() as u32;
            Ok(t)
        }

        fn close(&mut self) {
            if let ZipLoaderInner::File(_, fd) = self.inner {
                #[cfg(unix)]
                let _ = unsafe {libc::close(fd)};
                #[cfg(windows)]
                drop(unsafe {OwnedHandle::from_raw_handle(fd as *mut c_void)});
                self.inner = ZipLoaderInner::Closed;
            }
        }

        fn is_closed(&self) -> bool {
            matches!(self.inner, ZipLoaderInner::Closed)
        }
    }

    impl LuaUserData for ZipLoader {
        fn add_methods<'lua, T: LuaUserDataMethods<'lua, Self>>(_methods: &mut T) {
            _methods.add_method("name_list", |lua, this, ()| {
                let mut list = vec![];
                for v in this.raw_name_list.iter() {
                    list.push(lua.create_string(&v)?);
                }
                Ok(list)
            });

            _methods.add_method_mut("get", |lua, this, name: LuaString| {
                if this.is_closed() {
                    return Err(LuaError::RuntimeError("Zip archive is closed".to_string()));
                }
                match this.raw_name_list.iter().position(|v| *v == name.as_bytes()) {
                    Some(index) => {
                        let buf = this.get_by_index(index).map_err(LuaError::RuntimeError)?;
                        lua.create_string(&buf)
                    },
                    None => {
                        Err(LuaError::RuntimeError(format!("File not found in zip archive: {}", String::from_utf8_lossy(name.as_bytes()).to_string())))
                    }
                }
            });

            _methods.add_method_mut("get_mtime", |lua, this, name: LuaString| {
                if this.is_closed() {
                    return Err(LuaError::RuntimeError("Zip archive is closed".to_string()));
                }
                match this.raw_name_list.iter().position(|v| *v == name.as_bytes()) {
                    Some(index) => {
                        let mtime = this.get_metadata_by_index(index).map_err(LuaError::RuntimeError)?;
                        Ok(mtime)
                    },
                    None => {
                        Err(LuaError::RuntimeError(format!("File not found in zip archive: {}", String::from_utf8_lossy(name.as_bytes()).to_string())))
                    }
                }
            });

            _methods.add_method_mut("close", |_, this, ()| {
                this.close();
                Ok(())
            });
        }
    }

    pub fn init(lua_ctx: LuaContext) -> LuaResult<()> {
        let globals = lua_ctx.globals();
        globals.set("OpenZipFile", lua_ctx.create_function(|_, path: String| {
            ZipLoader::open(path).map_err(LuaError::RuntimeError)
        })?)?;
        globals.set("OpenZipFileInMemory", lua_ctx.create_function(|_, bytes: LuaString|{
            let bytes = bytes.as_bytes();
            ZipLoader::wrap_bytes(bytes).map_err(LuaError::RuntimeError)
        })?)?;
        Ok(())
    }
}