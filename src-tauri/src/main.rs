use std::arch::global_asm;
use std::{fs, result};
use std::path::PathBuf;
use std::process;
use std::error::Error;
use std::collections::HashMap;
use std::sync::Mutex;

use rlua::Variadic;
use rlua::{Lua, StdLib, InitFlags, Function, Table, Nil};
use rlua::prelude::{LuaResult, LuaError, LuaString};

use tauri::Manager;

mod image;
mod filesystem;
mod algorithm;
mod misc;
use crate::filesystem::lua_filesystem::Path as LuaPath;

struct LuaEnv {
    lua: Mutex<Lua>,
    state: Mutex<HashMap<String, String>>,
    init_errors: Mutex<HashMap<String, String>>,
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
            init_errors: Mutex::new(HashMap::new()),
        }
    }
}

fn main() {
    tauri::Builder::default()
        .manage(LuaEnv::new())
        .setup(|app| {
            lua_init(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![lua_console, lua_call, lua_call_async, lua_call_scope])
        .run(tauri::generate_context!())
        .expect("Failed to launch app");
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

/// call a lua ipc handler with a JSON string or "" as param
#[tauri::command]
fn lua_call(state: tauri::State<'_, LuaEnv>, api: String, param: String) -> Result<String, String> {
    state.lua.lock().unwrap().context(|lua_ctx| -> LuaResult<String>{
        let ipc = lua_ctx.globals().get::<_, Table>("IpcHandlers")?;
        let api_func = match ipc.get::<_, Function>(api.clone()) {
            Ok(f) => f,
            _ => return Err(LuaError::RuntimeError(format!("lua ipc handler not found: `{}`", api))),
        };
        let result = api_func.call::<_, String>(param)?;
        Ok(result)
    }).map_err(
        |e|format!("{:?}", e)
    )
}

#[tauri::command(async)]
async fn lua_call_async(state: tauri::State<'_, LuaEnv>, api: String, param: String) -> Result<String, String> {
    state.lua.lock().unwrap().context(|lua_ctx| -> LuaResult<String>{
        let ipc = lua_ctx.globals().get::<_, Table>("IpcHandlers")?;
        let api_func = match ipc.get::<_, Function>(api.clone()) {
            Ok(f) => f,
            _ => return Err(LuaError::RuntimeError(format!("lua ipc handler not found: `{}`", api))),
        };
        let result = api_func.call::<_, String>(param)?;
        Ok(result)
    }).map_err(
        |e|format!("{:?}", e)
    )
}

#[tauri::command(async)]
fn lua_call_scope<R: tauri::Runtime>(app: tauri::AppHandle<R>, window: tauri::Window<R>, state: tauri::State<'_, LuaEnv>,
    api: String, param: String) -> Result<String, String> {
    state.lua.lock().unwrap().context(|lua_ctx| -> LuaResult<String> {
        let globals = lua_ctx.globals();
        let ipc = globals.get::<_, Table>("IpcHandlers")?;
        let api_func = match ipc.get::<_, Function>(&api[..]) {
            Ok(f) => f,
            _ => return Err(LuaError::RuntimeError(format!("lua ipc handler not found: `{}`", api))),
        };
        // `app` cannot be shared between threads safely, use `lua_ctx.scope`
        lua_ctx.scope(|scope| -> LuaResult<String>{
            globals.set("IpcEmitEvent", scope.create_function(|_,(event, payload): (String, String)|{
                app.emit_all(&event, payload).unwrap();
                Ok(())
            })?)?;
            let result = api_func.call::<_, String>(param)?;
            Ok(result)
        })
    }).map_err(
        |e|format!("{:?}", e)
    )
}

fn lua_init(app: &mut tauri::App) -> LuaResult<()> {
    let resolver = app.path_resolver();
    let state = app.state::<LuaEnv>();
    let lua = state.lua.lock().unwrap();

    let app_dir = |path: Option<PathBuf>, create: bool|{
        if let Some(path) = path {
            if !path.is_dir() && create {
                if fs::create_dir_all(path.clone()).is_err() {
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

        // // 获取地址 未完成qwq
        // globals.set("addr", lua_ctx.create_function(|_, (obj): (Table)|{
        //     dbg!(obj);
        //     Ok(())
        // })?)?;

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
            println!("[以开发者环境运行]");
            PathBuf::from_iter(vec!["src", "scripts"])
        }
        else {
            let exe = std::env::args_os().next().unwrap_or_else(||{
                eprintln!("Failed to get exec path (args[0])");
                process::exit(1);
            });
            let exe = PathBuf::from(exe);
            let exedir = exe.parent().unwrap_or_else(||{
                eprintln!("Failed to get exec directory (Lua script root)");
                process::exit(1);
            });
            exedir.to_path_buf().join("scripts")
        };
        // package.path
        let package = globals.get::<_, Table>("package")?;
        let ori_path = package.get::<_, String>("path")?;
        let script_root_str = script_root.as_os_str().to_string_lossy();
        package.set("path", format!("{}{}?.lua;{}", 
            script_root_str, 
            std::path::MAIN_SEPARATOR, 
            ori_path))?;
        // SCRIPT_ROOT
        globals.set("SCRIPT_ROOT", format!("{}", script_root_str))?;

        // xpcall script
        let script_name = "main.lua";
        let script_full_path = format!("{}{}{}",
            script_root_str,
            std::path::MAIN_SEPARATOR,
            script_name
        );
        println!("Load: {}", script_full_path);
        if let Ok(s) = fs::read_to_string(script_full_path) {
            let func = lua_ctx.load(&s).set_name(&script_name)?.into_function()?;
            let xpcall = globals.get::<_, Function>("xpcall")?;
            let print_traceback = lua_ctx.load("
            function(e)
                print(e)
                print(debug.traceback()) 
            end").set_name("[CORE]")?.eval::<Function>()?;
            let success = xpcall.call::<_, bool>((func, 
                print_traceback, Variadic::<bool>::new()))?;
            if !success {
                eprintln!("\nError: script init runtime error");
            }
        }
        else {
            eprintln!("Error: Failed to read Lua scripts");
            process::exit(1);
        }         
        
        Ok(())
    })

}