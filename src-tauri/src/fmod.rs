use std::process::{Command, Stdio, Child};
use std::path::{PathBuf, Path};
use std::io::{Write, BufRead, BufReader};
use std::collections::HashMap;
use std::sync::mpsc::{sync_channel, Receiver, TryRecvError};
use json::JsonValue;

use crate::CommandExt;

#[derive(Debug, Default)]
struct FmodData {
    dirty: bool,
    content: String,
}

impl FmodData {
    pub fn new(content: String) -> Self {
        FmodData { dirty: true, content }
    }
}

pub struct FmodChild {
    inner: Child,
    rx: Receiver<String>,
    data: HashMap<String, FmodData>,
}

type FmodChildResult<T> = Result<T, String>;

impl FmodChild {
    pub fn new(bin_dir: PathBuf) -> FmodChildResult<Self> {
        unpack_fmod_binary(bin_dir.as_path())?;
        std::env::set_current_dir(&bin_dir)
            .map_err(|e| e.to_string())?;
        let name = format!("fmodcore{}", std::env::consts::EXE_SUFFIX);
        let mut child = Command::new(bin_dir.join(name))
            .set_no_console()
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;
        
        let (tx, rx) = sync_channel::<String>(32);
        let (tx_out, tx_err) = (tx.clone(), tx.clone());

        let stdout = child.stdout.take().unwrap();
        std::thread::spawn(move|| {
            BufReader::new(stdout).lines().for_each(|line|{
                let s = line.unwrap();
                if s.starts_with("[FMOD]") {
                    log::info!("{}", &s);
                }
                else {
                    tx_out.send(s).ok();
                }
            });
        });
        let stderr = child.stderr.take().unwrap();
        std::thread::spawn(move|| {
            BufReader::new(stderr).lines().for_each(|line|{
                let s = line.unwrap();
                if s.starts_with("[DEBUG]") {
                    log::info!("{}", &s);
                }
                else {
                    tx_err.send(format!("[FMOD.stderr] {}", s)).ok();
                }
            });
        });
    
        Ok(FmodChild { inner: child, data: HashMap::new(), rx })
    }

    pub fn send_message(&mut self, data: JsonValue) -> FmodChildResult<()> {
        if !data["api"].is_string() {
            return Err("Must provide data[\"api\"] as string".to_string());
        }
        if !data["args"].is_array() {
            return Err("Must provide data[\"args\"] as array".to_string());
        }
        match self.inner.stdin.as_ref() {
            Some(mut v)=> {
                v.write_all(json::stringify(data).as_bytes())
                    .map_err(|e| format!("Failed to write to stdin: {}", e))?;
                v.write_all("\n".as_bytes())
                    .map_err(|e| format!("Failed to write to stdin: {}", e))?;
                v.flush()
                    .map_err(|e| format!("Failed to flush stdin: {}", e))?;
                Ok(())
            },
            None=> Err("Failed to write to stdin as None".into())
        }
    }

    pub fn is_valid(&mut self) -> FmodChildResult<bool> {
        match self.inner.try_wait() {
            Ok(status)=> Ok(status.is_none()),
            Err(e)=> Err(e.to_string())
        }
    }

    pub fn kill(&mut self) -> FmodChildResult<()> {
        self.inner.kill().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update(&mut self) -> FmodChildResult<()> {
        let mut lines = Vec::<String>::new();
        loop {
            match self.rx.try_recv() {
                Ok(s)=> {
                    lines.push(s);
                },
                Err(TryRecvError::Empty)=> break,
                Err(TryRecvError::Disconnected)=> {
                    log::error!("Error in recv child message: TryRecvError::Disconnected");
                    return Err(TryRecvError::Disconnected.to_string());
                },
            }
        }
        lines.iter().for_each(|s|{
            // log::error!("> {}", &s[..usize::min(s.len() - 1, 200)]);
            if let Some(s) = s.strip_prefix("[RESULT]") {
                match json::parse(s) {
                    Ok(data)=> {
                        if let Err(e) = self.update_data(data) {
                            log::error!("Failed to parse result object from child process: {}", e)
                        }
                    },
                    Err(e)=> {
                        log::error!("Failed to parse message from child process: {}\n{}", e, s);
                    }
                }
            }
            else {
                log::error!("unparsed fmod message: {}", s);
            }
        });
        Ok(())
    }

    pub fn update_data(&mut self, mut data: JsonValue) -> FmodChildResult<()> {
        if !data["api"].is_string() {
            return Err("[FMOD] data[\"api\"] must be a string".into());
        }
        if !data["result"].is_object() {
            return Err("[FMOD] data[\"result\"] not exists".into());
        }
        let api = data["api"].take_string().unwrap();
        let result = data["result"].take();
        match api.as_str() {
            "LoadGameAssets"=> {
                self.data.insert("allfmodevent".into(), FmodData::new(json::stringify(result)));
            },
            "GetAllInfo"=> {
                self.data.insert("allinfo".into(), FmodData::new(json::stringify(result)));
            }
            _=> ()
        };
        Ok(())
    }
}

fn unpack_fmod_binary(bin_dir: &Path) -> Result<(), String> {
    let unpack_file = |name: &str, bytes: &[u8]| -> Result<(), String>{
        let path = bin_dir.join(name);
        if path.is_file(){
            if path.ends_with(".dylib") || path.ends_with(".dll") {
                // dynamic library is static
                return Ok(())
            }
            if let Ok(content) = std::fs::read(&path){
                // do not override if content is same
                if content == bytes {
                    return Ok(());
                }
            }
        }
        if bytes.is_empty() {
            return Err(format!("binary byte stream is empty: {}", name));
        }
        std::fs::write(path, bytes).map_err(|e|format!("Error in installing fmodcore [{}]: {}", name, e))
    };
    #[cfg(target_os = "macos")]
    {
        unpack_file("fmodcore", include_bytes!("../bin/fmod/fmodcore").as_slice())?;
        unpack_file("fmodext", include_bytes!("../bin/fmod/fmodext").as_slice())?;
        unpack_file("libfmodex.dylib", include_bytes!("../bin/fmod/libfmodex.dylib").as_slice())?;
        unpack_file("libfmodevent.dylib", include_bytes!("../bin/fmod/libfmodevent.dylib").as_slice())?;
        // chmod 777
        for name in ["fmodcore", "fmodext"] {
            let exec_path = bin_dir.join(name);
            use std::os::unix::fs::PermissionsExt;
            match exec_path.metadata() {
                Ok(meta)=> {
                    let mut p = meta.permissions();
                    p.set_mode(0o777);
                    std::fs::set_permissions(exec_path, p).ok();
                },
                Err(e)=> log::error!("Failed to set mode: {}", e),
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        unpack_file("fmodcore.exe", include_bytes!("../bin/fmod/fmodcore.exe").as_slice())?;
        unpack_file("fmodext.exe", include_bytes!("../bin/fmod/fmodext.exe").as_slice())?;
        unpack_file("fmodex64.dll", include_bytes!("../bin/fmod/fmodex64.dll").as_slice())?;
        unpack_file("fmod_event64.dll", include_bytes!("../bin/fmod/fmod_event64.dll").as_slice())?;
    }
    Ok(())
}

pub mod fmod_handler {
    use crate::FmodHandler;
    use crate::fmod::FmodChild;
    use log::info;

    #[tauri::command(async)]
    pub fn fmod_send_message(state: tauri::State<'_, FmodHandler>, data: String) -> Result<String, String> {
        let data = match json::parse(data.as_str()) {
            Ok(obj)=> obj,
            Err(e)=> return Err(format!("Failed to parse json: {}\n{}", e, &data))
        };
        if let Some(ref mut fmod) = state.fmod.lock().unwrap().as_mut() {
            if !fmod.is_valid()? {
                log::error!("fmodcore subprocess terminated");
                return Err("fmodcore subprocess terminated".into());
            }
            else {
                fmod.send_message(data)?;
            }
        };
        Ok("".into())
    }

    #[tauri::command]
    pub fn fmod_update(state: tauri::State<'_, FmodHandler>) -> Result<bool, String> {
        if let Some(ref mut fmod) = state.fmod.lock().unwrap().as_mut() {
            if fmod.is_valid()? {
                fmod.update()?;
            }
        };
        Ok(true)
    }

    /// get fmod playing data, if `only_dirty` flag is on, this function will only return changed items
    #[tauri::command(rename_all = "snake_case")]
    pub fn fmod_get_data(state: tauri::State<'_, FmodHandler>, only_dirty: bool) -> Result<String, String> {
        match state.fmod.lock().unwrap().as_mut() {
            Some(ref mut fmod)=> {
                if fmod.is_valid()? {
                    fmod.send_message(object! {"api": "GetAllInfo", "args": Vec::<String>::new()})?;
                    fmod.update()?;
                    let mut result = Vec::new();
                    fmod.data.iter_mut().for_each(|(k, v)|{
                        if v.dirty || !only_dirty {
                            result.push(vec![k.clone(), v.content.clone()]);
                        }
                        v.dirty = false;
                    });
                    Ok(json::stringify(result))
                }
                else {
                    Ok("".into())
                }
            },
            _=> Ok("".into()),
        }
    }

    #[tauri::command]
    pub fn fmod_reset(state: tauri::State<'_, FmodHandler>, data: String) -> Result<bool, String> {
        info!("[FMOD] reseting child process");
        if let Some(ref mut fmod) = state.fmod.lock().unwrap().as_mut() {
            let ok = fmod.kill().is_ok();
            info!("[FMOD] killed child process: {}", ok);
        }
        let bin_dir = state.bin_dir.lock().unwrap().clone();
        let _ = state.fmod.lock().unwrap().insert(FmodChild::new(bin_dir)?);
        info!("[FMOD] child process respawned");

        // init message (sound root)
        fmod_send_message(state, data)?;
        Ok(true)
    }
}

pub mod lua_fmod {
    use super::*;
    use rlua::prelude::{LuaResult, LuaContext, LuaError};
    use crate::filesystem::lua_filesystem::Path;
    pub fn init(lua: LuaContext) -> LuaResult<()> {
        let globals = lua.globals();
        globals.set("FsbExtractSync", lua.create_function(|lua: _, (fsb_filepath, index_list, dir): (String, Vec<u32>, Path)|{
            // get exec path from Lua globals (assigned in main.rs)
            // not elegant, but should run correctly
            let globals = lua.globals();
            let bin: Path = globals.get("APP_BIN_DIR")?;
            let fmod_workdir = bin.get_inner().join("fmod");
            unpack_fmod_binary(&bin.get_inner()).ok();
            std::env::set_current_dir(&fmod_workdir)
                .map_err(|e| LuaError::RuntimeError(format!("Failed to change work directory: {}", e)))?;
            let name = format!("fmodext{}", std::env::consts::EXE_SUFFIX);
            let result = Command::new(fmod_workdir.join(name))
                .set_no_console()
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::inherit())
                .args([
                    fsb_filepath,
                    index_list.iter().map(|v|v.to_string()).collect::<Vec<String>>().join(","),
                    dir.get_inner().to_string_lossy().to_string()])
                .output()
                .map_err(|e| LuaError::RuntimeError(format!("Failed to execute fmodext child process: {}", e)))?;

            let lines = String::from_utf8(result.stdout)
                .map_err(|e| LuaError::RuntimeError(format!("Failed to parse output: {}", e)))?;
            Ok(lines.split('\n')
                .map(|s| s.to_string())
                .collect::<Vec<String>>())

            // let (tx, rx) = sync_channel::<String>(32);
            // let (tx_out, tx_err) = (tx.clone(), tx.clone());

            // let stdout = child.stdout.take().unwrap();
            // std::thread::spawn(move|| {
            //     BufReader::new(stdout).lines().for_each(|line|{
            //         let s = line.unwrap();
            //         if s.starts_with("[FMOD]") {
            //             println!("{}", &s); // just print it
            //         }
            //         else {
            //             tx_out.send(s).ok();
            //         }
            //     });
            // });
            // let stderr = child.stderr.take().unwrap();
            // std::thread::spawn(move|| {
            //     BufReader::new(stderr).lines().for_each(|line|{
            //         let s = line.unwrap();
            //     });
            // });

            // Ok(true)
        })?)?;
        globals.set("FsbExtractAsync", lua.create_function(|lua: _, (fsb_filepath, index_list, dir): (String, Vec<u32>, Path)|{
            // non-blocking version
            unimplemented!();
            // // get exec path from Lua globals (assigned in main.rs)
            // // not elegant, but should run correctly
            // let globals = lua.globals();
            // let bin: Path = globals.get("APP_BIN_DIR")?;
            // let fmod_workdir = bin.get_inner().join("fmod");
            // unpack_fmod_binary(&bin.get_inner()).ok();
            // std::env::set_current_dir(&fmod_workdir)
            //     .map_err(|e| LuaError::RuntimeError(format!("Failed to change work directory: {}", e)))?;
            // let name = format!("fmodext{}", std::env::consts::EXE_SUFFIX);
            // let child = Command::new(fmod_workdir.join(name))
            //     .set_no_console()
            //     .stdin(Stdio::null())
            //     .stdout(Stdio::piped())
            //     .stderr(Stdio::inherit())
            //     .args([
            //         fsb_filepath,
            //         index_list.iter().map(|v|v.to_string()).collect::<Vec<String>>().join(","),
            //         dir.get_inner().to_string_lossy().to_string()])
            //     .spawn()
            //     .map_err(|e| LuaError::RuntimeError(format!("Failed to execute fmodext child process: {}", e)))?;
            //     
            Ok(true)
        })?)?;

        Ok(())
    }
}