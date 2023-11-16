use std::path::PathBuf;
use std::process;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;
use std::fs::create_dir_all;
use rlua::{Lua, StdLib, InitFlags, Function, Table, Nil, Value};
use rlua::prelude::{LuaResult, LuaError, LuaString};

use tauri::Manager;

#[macro_use]
extern crate json;

mod image;
mod filesystem;
mod algorithm;
mod misc;
mod ffmpeg;
mod fmod;
mod unzip;
mod args;
mod meilisearch;
use crate::filesystem::lua_filesystem::Path as LuaPath;
use fmod::FmodChild;
use meilisearch::MeilisearchChild;

use fmod::fmod_handler::*;
use meilisearch::meilisearch_handler::*;
use include_lua::ContextExt;
use include_lua_macro;

use tauri::{CustomMenuItem, Menu, MenuItem, Submenu};
fn menu() -> Menu {
    // 这里 `"quit".to_string()` 定义菜单项 ID，第二个参数是菜单项标签。
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let close = CustomMenuItem::new("close".to_string(), "Close");
    let submenu = Submenu::new("File", Menu::new().add_item(quit).add_item(close));
    Menu::new()
    .add_native_item(MenuItem::Copy)
    .add_item(CustomMenuItem::new("hide", "Hide"))
    .add_submenu(submenu)
}

struct LuaEnv {
    lua: Mutex<Lua>,
    state: Mutex<HashMap<String, String>>,
    interrupt_flag: Mutex<bool>,
    init_error: Mutex<String>,
}

impl LuaEnv {
    fn new() -> Self {
        let lua = unsafe { Lua::unsafe_new_with_flags(
            StdLib::ALL - StdLib::IO, // remove libio
            InitFlags::DEFAULT - InitFlags::LOAD_WRAPPERS,
        ) };
        LuaEnv { 
            lua: Mutex::new(lua),
            state: Mutex::new(HashMap::new()), 
            interrupt_flag: Mutex::new(false),
            init_error: Mutex::new(String::new()),
        }
    }
}

#[derive(Default)]
pub struct FmodHandler {
    fmod: Mutex<Option<FmodChild>>,
    init_error: Mutex<String>,
}

#[derive(Default)]
pub struct Meilisearch {
    meilisearch: Mutex<Option<MeilisearchChild>>,
    client: Mutex<Option<meilisearch_sdk::Client>>,
    init_error: Mutex<String>,
}

#[derive(Default)]
struct FE_Communi {
    drag_data: Mutex<HashMap<String, String>>,
}

fn main() {
    
    tauri::Builder::default()
        .manage(LuaEnv::new())
        .manage(FE_Communi::default())
        .manage(FmodHandler::default())
        .manage(Meilisearch::default())
        .setup(move|app| {
            lua_init(app)?;
            init_fmod(app)?;
            init_meilisearch(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_init,
            lua_console, 
            lua_call, 
            lua_interrupt,
            fmod_send_message,
            fmod_update,
            fmod_get_data,
            meilisearch_get_addr,
            select_file_in_folder,
            set_drag_data,
            get_drag_data,
            clear_drag_data,
            get_drag_data_all,
            shutdown,
        ])
        // .menu(menu())
        .run(tauri::generate_context!())
        .expect("Failed to launch app");
}

#[tauri::command(async)]
fn app_init<R: tauri::Runtime>(app: tauri::AppHandle<R>, window: tauri::Window<R>, state: tauri::State<'_, LuaEnv>) -> Result<String, String> {
    let init_error = String::from_str(&state.init_error.lock().unwrap()).unwrap();
    if init_error.len() > 0 {
        Err(init_error)
    }
    else {
        lua_call(app, window, state, "appinit".into(), "".into())
            .map(|b|"TODO:".to_string())
    }
}

/// debug function which runs Lua script in console
#[tauri::command]
fn lua_console(state: tauri::State<'_, LuaEnv>, script: String) {
    if script.len() == 0 {
        return ();
    }
    match state.lua.lock().unwrap().context(|lua_ctx|{
        lua_ctx.load(&script).exec()
    }) {
        Ok(_) => (),
        Err(e) => eprintln!("Lua exec error: {:?}", e),
    }
}

#[cfg(unix)]
#[tauri::command]
fn select_file_in_folder(path: String) -> bool {
    use std::process;
    process::Command::new("/usr/bin/open")
        .arg("-R")
        .arg(path)
        .status()
        .is_ok()
}

#[cfg(windows)]
#[tauri::command]
fn select_file_in_folder(path: String) -> bool {
    unimplemented!();
}

#[tauri::command]
fn shutdown<R: tauri::Runtime>(app: tauri::AppHandle<R>, reason: String) {
    println!("App shutdown <{}>", reason);
    app.exit(0);
}

enum LuaBytes{
    Utf8(String),
    Bytes(Vec<u8>),
}

impl LuaBytes {
    fn from(s: LuaString) -> Self {
        if let Ok(s) = s.to_str() {
            LuaBytes::Utf8(s.to_string())
        }
        else {
            LuaBytes::Bytes(s.as_bytes().to_vec())
        }
    }
}

impl serde::Serialize for LuaBytes {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: serde::Serializer {
        match self {
            LuaBytes::Bytes(b)=> b.serialize(serializer),
            LuaBytes::Utf8(s)=> s.serialize(serializer),
        }
    }
}

#[tauri::command(async)]
fn lua_call<R: tauri::Runtime>(app: tauri::AppHandle<R>, window: tauri::Window<R>, state: tauri::State<'_, LuaEnv>,
    api: String, param: String) -> Result<LuaBytes, String> {
    state.lua.lock().unwrap().context(|lua_ctx| -> LuaResult<LuaBytes> {
        let globals = lua_ctx.globals();
        let ipc = globals.get::<_, Table>("IpcHandlers")?;
        let api_func = match ipc.get::<_, Function>(&api[..]) {
            Ok(f) => f,
            _ => return Err(LuaError::RuntimeError(format!("lua ipc handler not found: `{}`", api))),
        };
        // `app` cannot be shared between threads safely, so use `lua_ctx.scope()`
        lua_ctx.scope(|scope| -> LuaResult<LuaBytes>{
            // register ipc util functions
            globals.set("IpcEmitEvent", scope.create_function(|_,(event, payload): (String, String)|{
                app.emit_all(&event, payload).unwrap();
                Ok(())
            })?)?;
            globals.set("IpcSetState", scope.create_function(|_,(key, value): (String, String)|{
                state.state.lock().unwrap().insert(key, value);
                Ok(())
            })?)?;
            globals.set("IpcInterrupted", scope.create_function(|_, ()|{
                Ok(*state.interrupt_flag.lock().unwrap())
            })?)?;

            // reset flag before ipc call
            *state.interrupt_flag.lock().unwrap() = false;
            // do call
            let result = api_func.call::<_, LuaString>(param)?;
            Ok(LuaBytes::from(result))
        })
    }).map_err(
        |e|match e {
            LuaError::RuntimeError(e)=> {
                if e.contains("IPC_INTERRUPTED") {
                    "IPC_INTERRUPTED".to_string()
                }
                else {
                    e
                }
            },
            other=> other.to_string(),
        }
    )
}

#[tauri::command(async)]
fn get_drag_data(state: tauri::State<'_, FE_Communi>, key: String) -> Option<String> {
    state.drag_data.lock().unwrap().get(&key).map(|s| s.to_string())
}

#[tauri::command(async)]
fn get_drag_data_all(state: tauri::State<'_, FE_Communi>) -> HashMap<String, String> {
    state.drag_data.lock().unwrap().clone()
}

#[tauri::command(async)]
fn set_drag_data(state: tauri::State<'_, FE_Communi>, key: String, value: String) {
    state.drag_data.lock().unwrap().insert(key, value);
    ()
}

#[tauri::command(async)]
fn clear_drag_data(state: tauri::State<'_, FE_Communi>) {
    state.drag_data.lock().unwrap().clear();
    ()
}

#[tauri::command]
fn lua_interrupt(state: tauri::State<'_, LuaEnv>) {
    *state.interrupt_flag.lock().unwrap() = true;
}

fn lua_init(app: &mut tauri::App) -> LuaResult<()> {
    let resolver = app.path_resolver();
    let state = app.state::<LuaEnv>();
    let lua = state.lua.lock().unwrap();

    let app_dir = |path: Option<PathBuf>, create: bool|{
        if let Some(path) = path {
            if !path.is_dir() && create {
                if std::fs::create_dir_all(path.clone()).is_err() {
                    eprintln!("Cannot create app directory: {}", path.to_string_lossy());
                }
            }
            if path.is_dir() {
                return Some(LuaPath::new(path));
            }
        }
        return None;
    };

    lua.context(|lua_ctx| -> LuaResult<()>{
        let globals = lua_ctx.globals();
 
        globals.set("APP_CACHE_DIR", app_dir(resolver.app_cache_dir(), true))?;
        globals.set("APP_CONFIG_DIR", app_dir(resolver.app_config_dir(), true))?;
        globals.set("APP_LOG_DIR", app_dir(resolver.app_log_dir(), true))?;
        globals.set("APP_DATA_DIR", app_dir(resolver.app_data_dir(), true))?;
        
        globals.set("HOME_DIR", app_dir(tauri::api::path::home_dir(), false))?;
        globals.set("DOWNLOAD_DIR", app_dir(tauri::api::path::download_dir(), false))?;

        if cfg!(windows) {
            globals.set("PLATFORM", "WINDOWS")?;
        }
        else if cfg!(target_os = "macos") {
            globals.set("PLATFORM", "MACOS")?;
        }
        else if cfg!(target_os = "linux") {
            globals.set("PLATFORM", "LINUX")?;
        }
        else {
            globals.set("PLATFORM", "UNKNOWN")?;
        }

        let init_error = |name: &'static str|{
            move |err|{
                eprintln!("Error in initializing {}: {:?}", name, err);
                process::exit(1);
            }
        };
            
        // Lua modules
        image::lua_image::init(lua_ctx).unwrap_or_else(init_error("lua_image"));
        filesystem::lua_filesystem::init(lua_ctx).unwrap_or_else(init_error("lua_filesystem"));
        algorithm::lua_algorithm::init(lua_ctx).unwrap_or_else(init_error("lua_algorithm"));
        misc::lua_misc::init(lua_ctx).unwrap_or_else(init_error("lua_misc"));
        args::lua_args::init(lua_ctx).unwrap_or_else(init_error("lua_args"));
        ffmpeg::lua_ffmpeg::init(lua_ctx).unwrap_or_else(init_error("ffmpeg"));

        // delete some functions
        globals.set("dofile", Nil)?;
        globals.set("load", Nil)?;
        globals.set("loadfile", Nil)?;
        // let old_loadstring = globals.get::<_, Function>("loadstring")?;
        globals.set("loadstring", lua_ctx.create_function(|lua, (s, chunkname): (LuaString, Option<String>)|{
            if s.as_bytes().len() == 0 {
                Err(LuaError::RuntimeError("loadstring: try to load an empty string".to_string()))
            }
            else if s.as_bytes().get(0) == Some(&27) {
                Err(LuaError::RuntimeError("loadstring: loading binary chunks is not allowed".to_string()))
            }
            else {
                Ok(match chunkname {
                    Some(name)=> lua.load(&s)
                        .set_name(&name)?
                        .into_function(),
                    None => lua.load(&s)
                        .into_function()
                })
            }
        })?)?;

        let workdir = std::env::current_dir().unwrap_or(PathBuf::new());
        let script_root = if workdir.join("Cargo.toml").exists() { // 判定开发者环境, 有点不好, 以后要删了
            println!("[DEBUG] Enable dynamic script loading");
            PathBuf::from_iter(vec!["src", "scripts"])
        }
        else {
            PathBuf::new()
        };
        // package.path
        let package = globals.get::<_, Table>("package")?;
        let ori_path = package.get::<_, String>("path")?;
        let script_root_str = script_root.as_os_str().to_string_lossy();
        if script_root_str.len() > 0 {
            package.set("path", format!("{}{}?.lua;{}", 
                script_root_str, 
                std::path::MAIN_SEPARATOR, 
                ori_path))?;
        }
        // SCRIPT_ROOT
        globals.set("SCRIPT_ROOT", format!("{}{}", 
            script_root_str,
            std::path::MAIN_SEPARATOR))?;

        // static scripts loading
        #[allow(non_upper_case_globals)]
        let module = include_lua_macro::include_lua!("scripts");
        lua_ctx.add_modules(module)?;

        // run
        let (success, err) = lua_ctx.load("
            local success, err
            success = xpcall(require, function(e)
                err = tostring(e) .. \"\\n\" .. debug.traceback()
                print(err)
            end, \"main\")
            return success, tostring(err)
        ").set_name("[CORE]")?.eval::<(bool, Value)>()?;
        if !success {
            match err {
                Value::String(s)=> {
                    let mut s = String::from_utf8_lossy(s.as_bytes()).to_string();
                    s.push('\n');
                    eprintln!("Error init lua: {:?}", &s);
                    state.init_error.lock().unwrap().push_str(&s);
                },
                _ => {
                    eprintln!("Error init lua: unknown error");
                    state.init_error.lock().unwrap().push_str("unknown error");
                }
            }
        }

        // exit in cli mode
        match globals.raw_get::<_, Value>("Args")? {
            Value::UserData(_)=> std::process::exit(0),
            _ => ()
        }
        
        Ok(())
    })
}

fn init_fmod(app: &mut tauri::App) -> Result<(), String> {
    let state = app.state::<FmodHandler>();
    let app_data_dir = app.path_resolver().app_data_dir()
        .ok_or("Failed to get app_data_dir".to_string())?;
    let bin_dir = app_data_dir.join("bin").join("fmod");
    create_dir_all(bin_dir.clone())
        .map_err(|e|format!("Failed to create bin dir: {} {}", bin_dir.display(), e))?;
    
    match FmodChild::new(bin_dir) {
        Ok(child)=> {
            println!("[FMOD] child process spawned");
            #[allow(unused_must_use)]
            {
                state.fmod.lock().unwrap().insert(child);
            }
        },
        Err(e)=> {
            eprintln!("[FMOD] Error in init: {}", &e);
            state.init_error.lock().unwrap().push_str(e.as_str())
        },
    }
    Ok(())
}

fn init_meilisearch(app: &mut tauri::App) -> Result<(), String> {
    let state = app.state::<Meilisearch>();
    let app_data_dir = app.path_resolver().app_data_dir()
        .ok_or("Failed to get app_data_dir".to_string())?;
    let bin_dir = app_data_dir.join("bin").join("meilisearch");
    create_dir_all(bin_dir.clone())
        .map_err(|e|format!("Failed to create bin dir: {} {}", bin_dir.display(), e))?;
    match MeilisearchChild::new(bin_dir) {
        Ok(child)=> {
            println!("[Meilisearch] child process spawned");
            #[allow(unused_must_use)]
            {
                state.meilisearch.lock().unwrap().insert(child);
            }
        },
        Err(e)=> {
            eprintln!("[Meilisearch] Error in init: {}", &e);
            state.init_error.lock().unwrap().push_str(e.as_str())
        }
    }
    // launch client if child process is on
    let child = state.meilisearch.lock().unwrap();
    if child.is_some() {
        let addr = child.as_ref().unwrap().get_addr();
        println!("[Meilisearch] link to child process: {}", &addr);
        let client = meilisearch_sdk::Client::new(addr, None::<String>);
        *state.client.lock().unwrap() = Some(client);
    }
    Ok(())
}