#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#![allow(unused)]
#![allow(dead_code)]

use std::path::PathBuf;
use std::process;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;
use std::fs::create_dir_all;
use rlua::{Lua, StdLib, InitFlags, Function, Table, Nil, Value};
use rlua::prelude::{LuaResult, LuaError, LuaString};
extern crate simplelog;
extern crate log;
use simplelog::*;
#[allow(unused_imports)]
use log::{info, error, warn};

use tauri::{Manager, Emitter};

#[macro_use]
extern crate json;

mod image;
mod filesystem;
mod algorithm;
mod misc;
mod ffmpeg;
mod fmod;
mod fmodparse;
mod audio;
mod args;
mod meilisearch;
mod es;
mod fastindex;
mod quicklook;
use crate::filesystem::lua_filesystem::Path as LuaPath;
use fmod::FmodChild;
use meilisearch::MeilisearchChild;
use quicklook::{open_quicklook_windows, add_quicklook_recent_files};
use fmod::fmod_handler::*;
use meilisearch::meilisearch_handler::*;
#[cfg(target_os="windows")]
#[allow(unused_imports)]
use es::es_handler::*;

use include_lua::ContextExt;

const TEXT_GUARD: &str = "🦀️";

struct LuaEnv {
    lua: Mutex<Lua>,
    state: Mutex<HashMap<String, String>>,
    interrupt_flag: Mutex<bool>,
    init_error: Mutex<String>,
    debug_script_root: Mutex<Option<PathBuf>>,
}

impl LuaEnv {
    fn new() -> Self {
        LuaEnv { 
            lua: Mutex::new(Self::new_lua()),
            state: Mutex::new(HashMap::new()), 
            interrupt_flag: Mutex::new(false),
            init_error: Mutex::new(String::new()),
            debug_script_root: Mutex::new(None),
        }
    }

    #[inline]
    fn new_lua() -> Lua {
        unsafe { Lua::unsafe_new_with_flags(
            StdLib::ALL - StdLib::IO, // remove libio
            InitFlags::DEFAULT - InitFlags::LOAD_WRAPPERS,
        ) }
    }

    /// store root on first call, return stored root on reloading
    fn get_debug_script_root(&self, path: PathBuf) -> PathBuf {
        let mut root = self.debug_script_root.lock().unwrap();
        if root.is_some() {
            root.clone().unwrap()
        }
        else {
            let _ = root.insert(path.clone());
            path
        }
    }

    fn reload(&self) {
        *self.lua.lock().unwrap() = LuaEnv::new_lua();
    }
}

#[derive(Default)]
pub struct FmodHandler {
    fmod: Mutex<Option<FmodChild>>,
    init_error: Mutex<String>,
    /// save bin path for reset command
    bin_dir: Mutex<PathBuf>,
}

#[derive(Default)]
pub struct Meilisearch {
    meilisearch: Mutex<Option<MeilisearchChild>>,
    init_error: Mutex<String>,
}

#[derive(Default)]
struct FeCommuni {
    drag_data: Mutex<HashMap<String, String>>,
}

#[tauri::command]
fn get_log_path(handle: tauri::AppHandle) -> PathBuf {
    let path = handle.path().app_data_dir().unwrap().join("log").join("log.txt");
    path
}

#[tauri::command]
fn reveal_log_file(handle: tauri::AppHandle) -> bool {
    use tauri_plugin_opener::OpenerExt;
    let path = get_log_path(handle.clone());
    handle.opener().reveal_item_in_dir(path).is_ok()
}

fn init_logger(app: &mut tauri::App) -> Result<(), String> {
    let mut loggers: Vec<Box<dyn SharedLogger>> = vec![
        TermLogger::new(LevelFilter::Info, Config::default(), TerminalMode::Mixed, ColorChoice::Auto),
    ];
    // log file
    let log_dir = app.path().app_data_dir().unwrap().join("log");
    if create_dir_all(log_dir.clone()).is_ok() {
        loggers.push(WriteLogger::new(LevelFilter::Info, Config::default(), 
            std::fs::File::create(log_dir.join("log.txt")).unwrap()));
    }
    CombinedLogger::init(loggers).map_err(|e|e.to_string())
}


fn main() {    
    tauri::Builder::default()
        .manage(LuaEnv::new())
        .manage(FeCommuni::default())
        .manage(FmodHandler::default())
        .manage(Meilisearch::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(move|app| {
            let handle = app.handle().clone();
            let on_error = |module: &str, msg: String| {
                error!("failed to init {}: {}", module, msg);
                use tauri_plugin_dialog::*;
                handle.dialog()
                    .message(format!("Error in {}:\n{}", module, msg))
                    .title("Error")
                    .buttons(MessageDialogButtons::Ok)
                    .kind(MessageDialogKind::Error)
                    .show(|_|std::process::exit(1));
            };
            if let Err(e) = init_logger(app) {
                on_error("logger", e);
            }
            if let Err(e) = init_lua(app) {
                on_error("lua", e.to_string());
            }
            if let Err(e) = init_fmod(app) {
                on_error("fmod", e);
            }
            if let Err(e) = init_meilisearch(app) {
                on_error("meilisearch", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_init,
            lua_console, 
            lua_call, 
            lua_interrupt,
            lua_reload,
            open_url,
            fmod_send_message,
            fmod_update,
            fmod_get_data,
            fmod_reset,
            meilisearch_get_addr,
            get_log_path,
            reveal_log_file,
            select_file_in_folder,
            open_quicklook_windows,
            add_quicklook_recent_files,
            set_drag_data,
            get_drag_data,
            clear_drag_data,
            get_drag_data_all,
            shutdown,
        ])
        .append_invoke_initialization_script(format!(r#"
            window.show_debug_tools = {};
            window.text_guard = "{}";
        "#,
            !get_is_publish_build(),
            TEXT_GUARD
        ))
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    info!("Close main window");
                    std::process::exit(0);
                    // #[cfg(target_os = "macos")]
                    // {
                    //     tauri::AppHandle::hide(window.app_handle()).unwrap();
                    //     api.prevent_close();
                    // }
                    // #[cfg(not(target_os = "macos"))]
                    // {
                    //     window.destroy().unwrap();
                    // }
                }
            },
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("Failed to launch app");
}

#[tauri::command(async)]
fn app_init<R: tauri::Runtime>(app: tauri::AppHandle<R>, window: tauri::Window<R>, state: tauri::State<'_, LuaEnv>) -> Result<String, String> {
    let init_error = String::from_str(&state.init_error.lock().unwrap()).unwrap();
    if !init_error.is_empty() {
        Err(init_error)
    }
    else {
        lua_call(app, window, state, "appinit".into(), "".into())
            .map(|_|"TODO:".to_string())
    }
}

/// debug function which runs Lua script in console
#[tauri::command]
fn lua_console(state: tauri::State<'_, LuaEnv>, script: String) {
    if !script.is_empty() {
        match state.lua.lock().unwrap().context(|lua_ctx|{
            lua_ctx.load(&script).exec()
        }) {
            Ok(_) => (),
            Err(e) => eprintln!("Lua exec error: {:?}", e),
        }
    }
}

#[tauri::command]
fn select_file_in_folder(handler: tauri::AppHandle, path: String) -> bool {
    use tauri_plugin_opener::OpenerExt;
    handler.opener().reveal_item_in_dir(path).is_ok()
}

fn get_is_publish_build() -> bool {
    cfg!(feature = "publish")
}

#[tauri::command]
fn open_url(url: String) -> bool {
    webbrowser::open(url.as_str()).is_ok()
}

// #[tauri::command]
// fn dev_host() -> String {
//     std::env::var("ASSET_ARCHIVE_DEV_HOST")
//         .unwrap_or("".to_string())
// }

#[tauri::command]
fn shutdown<R: tauri::Runtime>(app: tauri::AppHandle<R>, reason: String) {
    info!("App shutdown <{}>", reason);
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
        // #[cfg(debug_assertions)]
        // let time = std::time::Instant::now();
        let result = match self {
            LuaBytes::Bytes(b)=> b.serialize(serializer),
            LuaBytes::Utf8(s)=> s.serialize(serializer),
        };
        // #[cfg(debug_assertions)]
        // println!("serialize LuaBytes: {:?}", time.elapsed());
        result
    }
}

#[tauri::command(async)]
fn lua_call<R: tauri::Runtime>(app: tauri::AppHandle<R>, _window: tauri::Window<R>, state: tauri::State<'_, LuaEnv>,
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
                app.emit(&event, payload).unwrap();
                Ok(())
            })?)?;
            globals.set("IpcSetState", scope.create_function(|_,(key, value): (String, String)|{
                state.state.lock().unwrap().insert(key, value);
                Ok(())
            })?)?;
            globals.set("IpcInterrupted", scope.create_function(|_, ()|{
                Ok(*state.interrupt_flag.lock().unwrap())
            })?)?;

            // NOTE: this function only available in lua call
            // TODO: impl in CLI mode
            globals.set("SelectFileInFolder", scope.create_function(|_, path: String|{
                use tauri_plugin_opener::OpenerExt;
                Ok(app.opener().reveal_item_in_dir(path).is_ok())
            })?)?;
            // allow tauri to read this file
            globals.set("Core_AllowFile", scope.create_function(|_, path: String|{
                let tauri_scope = app.state::<tauri::scope::Scopes>();
                tauri_scope.allow_file(&path);
                Ok(true)
            })?)?;

            // reset flag before ipc call
            *state.interrupt_flag.lock().unwrap() = false;
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
fn get_drag_data(state: tauri::State<'_, FeCommuni>, key: String) -> Option<String> {
    state.drag_data.lock().unwrap().get(&key).map(|s| s.to_string())
}

#[tauri::command(async)]
fn get_drag_data_all(state: tauri::State<'_, FeCommuni>) -> HashMap<String, String> {
    state.drag_data.lock().unwrap().clone()
}

#[tauri::command(async)]
fn set_drag_data(state: tauri::State<'_, FeCommuni>, key: String, value: String) {
    state.drag_data.lock().unwrap().insert(key, value);
}

#[tauri::command(async)]
fn clear_drag_data(state: tauri::State<'_, FeCommuni>) {
    state.drag_data.lock().unwrap().clear();
}

#[tauri::command]
fn lua_interrupt(state: tauri::State<'_, LuaEnv>) {
    *state.interrupt_flag.lock().unwrap() = true;
}

fn init_lua(app: &mut tauri::App) -> LuaResult<()> {
    init_lua_impl(app.handle().clone(), app.state::<LuaEnv>())
}

#[tauri::command]
fn lua_reload(handle: tauri::AppHandle, state: tauri::State<'_, LuaEnv>) -> Result<(), String> {
    state.reload();
    init_lua_impl(handle, state)
        .map_err(|e|e.to_string())
}

fn init_lua_impl(handle: tauri::AppHandle, state: tauri::State<'_, LuaEnv>) -> LuaResult<()> {
    info!("[LUA] init lua vm");
    let app_dir = |path: Result<PathBuf, tauri::Error>, create: bool|{
        if let Ok(path) = path {
            #[allow(clippy::collapsible_if)]
            if !path.is_dir() && create {
                if std::fs::create_dir_all(path.clone()).is_err() {
                    error!("Cannot create app directory: {}", path.to_string_lossy());
                }
            }
            if path.is_dir() {
                return Some(LuaPath::new(path));
            }
        }
        None
    };
    
    let lua = state.lua.lock().unwrap();
    lua.context(|lua_ctx| -> LuaResult<()>{
        let globals = lua_ctx.globals();

        info!("[LUA] register app paths");
        let resolver = handle.path();
        globals.set("APP_CACHE_DIR", app_dir(resolver.app_cache_dir(), true))?;
        globals.set("APP_CONFIG_DIR", app_dir(resolver.app_config_dir(), true))?;
        globals.set("APP_LOG_DIR", app_dir(resolver.app_log_dir(), true))?;
        globals.set("APP_DATA_DIR", app_dir(resolver.app_data_dir(), true))?;
        globals.set("APP_BIN_DIR", app_dir(resolver.app_data_dir().map(|p|p.join("bin")), true))?;
        
        globals.set("HOME_DIR", app_dir(resolver.home_dir(), false))?;
        globals.set("DOWNLOAD_DIR", app_dir(resolver.download_dir(), false))?;

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
                error!("Error in initializing {}: {:?}", name, err);
                process::exit(1);
            }
        };

        info!("[LUA] init basic modules");
            
        // Lua modules
        image::lua_image::init(lua_ctx).unwrap_or_else(init_error("lua_image"));
        filesystem::lua_filesystem::init(lua_ctx).unwrap_or_else(init_error("lua_filesystem"));
        algorithm::lua_algorithm::init(lua_ctx).unwrap_or_else(init_error("lua_algorithm"));
        misc::lua_misc::init(lua_ctx).unwrap_or_else(init_error("lua_misc"));
        args::lua_args::init(lua_ctx).unwrap_or_else(init_error("lua_args"));
        ffmpeg::lua_ffmpeg::init(lua_ctx).unwrap_or_else(init_error("ffmpeg"));
        fmod::lua_fmod::init(lua_ctx).unwrap_or_else(init_error("fmod"));
        fastindex::lua_fastindex::init(lua_ctx).unwrap_or_else(init_error("fastindex"));
        fmodparse::lua_fmodparse::init(lua_ctx).unwrap_or_else(init_error("fmodparse"));
        quicklook::lua_quicklook::init(lua_ctx).unwrap_or_else(init_error("quicklook"));

        info!("[LUA] remove default loaders");

        // delete some functions
        globals.set("dofile", Nil)?;
        globals.set("load", Nil)?;
        globals.set("loadfile", Nil)?;
        globals.set("loadstring", lua_ctx.create_function(|lua, (s, chunkname): (LuaString, Option<String>)|{
            if s.as_bytes().is_empty() {
                Err(LuaError::RuntimeError("loadstring: try to load an empty string".to_string()))
            }
            else if s.as_bytes().first() == Some(&27) {
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
        globals.set("print_info", lua_ctx.create_function(|_, s: LuaString|{
            info!("{}", String::from_utf8_lossy(s.as_bytes()).to_string());
            Ok(())
        })?)?;
        globals.set("print_warn", lua_ctx.create_function(|_, s: LuaString|{
            warn!("{}", String::from_utf8_lossy(s.as_bytes()).to_string());
            Ok(())
        })?)?;
        globals.set("print_error", lua_ctx.create_function(|_, s: LuaString|{
            error!("{}", String::from_utf8_lossy(s.as_bytes()).to_string());
            Ok(())
        })?)?;

        info!("[LUA] register package loader");

        let workdir = state.get_debug_script_root(std::env::current_dir().unwrap_or_default());
        info!("[LUA] current workdir: {:?}", &workdir);
        globals.set("APP_WORK_DIR", LuaPath::new(workdir.clone()))?;
        let script_root = if !get_is_publish_build() && workdir.join("Cargo.toml").exists() {
            info!("[DEBUG] Enable dynamic script loading");
            workdir.join("src").join("scripts")
        }
        else {
            PathBuf::new()
        };
        // package.path
        let package = globals.get::<_, Table>("package")?;
        let ori_path = package.get::<_, LuaString>("path")?;
        let script_root_str = script_root.as_os_str().to_string_lossy();
        if script_root_str.len() > 0 {
            info!("[DEBUG] SCRIPT_ROOT = {}", script_root_str);
            package.set("path", format!("{}{}?.lua;",
                script_root_str, 
                std::path::MAIN_SEPARATOR))?;
        }
        // SCRIPT_ROOT
        globals.set("SCRIPT_ROOT", format!("{}{}", 
            script_root_str,
            std::path::MAIN_SEPARATOR))?;

        // magic text guard
        globals.set("TEXT_GUARD", TEXT_GUARD.to_string())?;

        // static scripts loading
        #[allow(non_upper_case_globals)]
        let module = include_lua_macro::include_lua!("scripts");
        lua_ctx.add_modules(module)?;

        info!("[LUA] run main script");

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
                    error!("[LUA] Error init lua: {:?}", &s);
                    state.init_error.lock().unwrap().push_str(&s);
                },
                _ => {
                    error!("[LUA] Error init lua: unknown error");
                    state.init_error.lock().unwrap().push_str("unknown error");
                }
            }
        }

        // exit in cli mode
        if let Value::UserData(_) = globals.raw_get::<_, Value>("Args")? {
            std::process::exit(0);
        }

        info!("[LUA] init done");
        
        Ok(())
    })
}

fn init_fmod(app: &mut tauri::App) -> Result<(), String> {
    let state = app.state::<FmodHandler>();
    let app_data_dir = app.path().app_data_dir()
        .map_err(|_|"Failed to get app_data_dir".to_string())?;
    let bin_dir = app_data_dir.join("bin").join("fmod");
    create_dir_all(bin_dir.clone())
        .map_err(|e|format!("Failed to create bin dir: {} {}", bin_dir.display(), e))?;
    *state.bin_dir.lock().unwrap() = bin_dir.clone();
    
    match FmodChild::new(bin_dir) {
        Ok(child)=> {
            info!("[FMOD] child process spawned");
            #[allow(unused_must_use)]
            {
                state.fmod.lock().unwrap().insert(child);
            }
        },
        Err(e)=> {
            error!("[FMOD] Error in init: {}", &e);
            state.init_error.lock().unwrap().push_str(e.as_str())
        },
    }

    // add tracker
    let handle = app.handle().clone();
    audio::start_tracking(move |v| {
        handle.emit("fmod_audio_device", v).ok();
        info!("[Audio] Default output device changed to: {}", v)
    });

    Ok(())
}

fn init_meilisearch(app: &mut tauri::App) -> Result<(), String> {
    let state = app.state::<Meilisearch>();
    let app_data_dir = app.path().app_data_dir()
        .map_err(|_|format!("Failed to get app_data_dir"))?;
    let bin_dir = app_data_dir.join("bin").join("meilisearch");
    create_dir_all(bin_dir.clone())
        .map_err(|e|format!("Failed to create bin dir: {} {}", bin_dir.display(), e))?;
    match MeilisearchChild::new(bin_dir) {
        Ok(child)=> {
            info!("[Meilisearch] child process spawned");
            #[allow(unused_must_use)]
            {
                state.meilisearch.lock().unwrap().insert(child);
            }
        },
        Err(e)=> {
            error!("[Meilisearch] Error in init: {}", &e);
            state.init_error.lock().unwrap().push_str(e.as_str())
        }
    };
    Ok(())
}

pub trait CommandExt {
    fn set_no_console(&mut self) -> &mut process::Command;
}

impl CommandExt for process::Command {
    fn set_no_console(&mut self) -> &mut process::Command {
        #[cfg(target_os="windows")]
        {
            use std::os::windows::process::CommandExt;
            self.creation_flags(0x08000000);
        }
        self
    }
}