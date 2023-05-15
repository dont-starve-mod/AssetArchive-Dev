use std::io;
use std::fs;
use std::path::PathBuf;
use std::process;
use std::error::Error;
use std::time::{SystemTime, UNIX_EPOCH};
use std::collections::HashMap;
use std::sync::{Mutex};


use rlua::{Lua, StdLib, InitFlags, Function, Table, FromLua};
use rlua::Result as LuaResult;
use rlua::Error as LuaError;

use tauri::Event;
use tauri::Manager;
use tauri::command;
use tauri::generate_handler;

mod image;
mod filesystem;
mod algorithm;
use crate::filesystem::lua_filesystem::Path as LuaPath;

struct LuaEnv {
    // lua: Arc<Mutex<Lua>>,
    lua: Mutex<Lua>,
    init_errors: Mutex<HashMap<String, String>>,
}

impl LuaEnv {
    fn new() -> Self {
        let lua = unsafe {Lua::unsafe_new_with_flags(
            StdLib::ALL - StdLib::IO, // 保留debug库, 去除io库
            InitFlags::DEFAULT - InitFlags::LOAD_WRAPPERS, // 禁用load patch, 该patch会修改io库, 引发nil报错)
        ) };
        // LuaEnv { lua: Arc::new(Mutex::new(lua)) }
        LuaEnv { 
            lua: Mutex::new(lua), 
            init_errors: Mutex::new(HashMap::<_, _>::new()),
        }
    }
}

fn main() {
    tauri::Builder::default()
        .manage(LuaEnv::new())
        .setup(|app| {
            lua_init(app)?;
            lua_postinit(app)?;

            // return Err("12345".into()); // 强制终止
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![lua_console, lua_call])
        .run(tauri::generate_context!())
        .expect("Failed to launch app");
}

#[tauri::command]
fn lua_console(state: tauri::State<'_, LuaEnv>, script: String) {
    println!("{:?}", script);
    match state.lua.lock().unwrap().context(|lua_ctx|{
        lua_ctx.load(&script).exec()
    }) {
        Ok(_) => (),
        Err(e) => eprintln!("Lua exec error: {:?}", e),
    }
}

#[tauri::command]
fn lua_call(state: tauri::State<'_, LuaEnv>, api: String, param: String) -> Result<String, String> {
    // use rlua::String as LuaString;
    println!("Run lua call: {:?} {:?}", api, param);
    state.lua.lock().unwrap().context(|lua_ctx| -> LuaResult<String>{
        let ipc = lua_ctx.globals().get::<_, Table>("IpcHandlers")?;
        let api_func = ipc.get::<_, Function>(api)?;
        let result = api_func.call::<_, String>(param)?;
        Ok(result)
    }).map_err(
        |e|format!("{:?}", e)
    )
}

fn lua_init(app: &mut tauri::App) -> LuaResult<()> {
    let resolver = app.path_resolver();
    let state = app.state::<LuaEnv>();
    let lua = state.lua.lock().unwrap();

    let app_dir = |path: Option<PathBuf>|{
        if let Some(path) = path {
            if !path.is_dir() {
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
 
        globals.set("APP_CACHE_DIR", app_dir(resolver.app_cache_dir()))?;
        globals.set("APP_CONFIG_DIR", app_dir(resolver.app_config_dir()))?;
        globals.set("APP_LOG_DIR", app_dir(resolver.app_log_dir()))?;
        
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
            
        // Lua userdata
        image::lua_image::init(lua_ctx).unwrap_or_else(init_error("lua_image"));
        filesystem::lua_filesystem::init(lua_ctx).unwrap_or_else(init_error("lua_filesystem"));
        algorithm::lua_algorithm::init(lua_ctx).unwrap_or_else(init_error("lua_algorithm"));
        
        // timestamp
        globals.set("now", lua_ctx.create_function(|_, ()|{
            let time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis();
            Ok(time)
        })?)?;

                // globals.set("IPC_EmitEvent", lua_ctx.create_function(move|_, (event, payload): (String, String)|{
        //     // let main_window = app.get_window("main").unwrap();
        //     main_window.emit(&event, payload).map_err(|err|{
        //         LuaError::RuntimeError(format!("Rust: Failed to emit event: {:?}", err))
        //     })
        // })?)?;

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

        // 加载文件
        let script_name = "main.lua";
        let script_full_path = format!("{}{}{}",
            script_root_str,
            std::path::MAIN_SEPARATOR,
            script_name
        );
        println!("Load: {}", script_full_path);
        if let Ok(s) = fs::read_to_string(script_full_path) {
            lua_ctx.load(&s).set_name(&script_name)?.exec()?;
        }
        else {
            eprintln!("Error: Failed to load Lua scripts");
            process::exit(1);
        }         
        
        Ok(())
    })

}

fn lua_postinit(app: &mut tauri::App) -> LuaResult<()> {
    let state = app.state::<LuaEnv>();
    let lua = state.lua.lock().unwrap();
    lua.context(|lua_ctx| -> LuaResult<()>{
        let main_window1 = app.get_window("main").unwrap();
        let main_window2 = app.get_window("main").unwrap();
        let main_window3 = app.get_window("main").unwrap();
        let main_window4 = app.get_window("main").unwrap();

        let globals = lua_ctx.globals();
        // tauri console
        // main_window.listen("console", |event|{
        //     match lua_ctx.load(event.payload().unwrap()).exec() {
        //         Ok(_)=> (),
        //         Err(e)=> println!("{:?}", e),
        //     }
        // });
        // tauri Event
        


        Ok(())
    })
}