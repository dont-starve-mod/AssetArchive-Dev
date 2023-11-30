use std::collections::HashMap;
use std::collections::hash_map::Entry;
use std::ffi::OsStr;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use once_cell::sync::Lazy;

#[derive(Debug)]
struct DownloadState {
    id: String,
    url: String,
    /// download progress (WARN: some web server not support)
    current: f64,
    /// download progress (WARN: some web server not support)
    total: f64,
    /// actual downloaded bytes length, updated by Handler.write()
    current_downloaded: usize,
    /// start time of session
    start: f64,
    /// status of download session
    /// WORKING | ERROR | CENCEL
    status: String,
    /// downloaded bytes
    /// only awailable after downloading was totally finished
    data: Vec<u8>,
}

static DOWNLOAD_STATE: Lazy<Mutex<HashMap<String, DownloadState>>> = Lazy::new(||{
    Mutex::new(HashMap::with_capacity(4))
});

/// validate ffmpeg by run `ffmpeg -version`
fn run_version<P: AsRef<OsStr>>(path: P) -> Result<bool, String> {
  Command::new(path)
    .arg("-version")
    .stderr(Stdio::piped())
    .stdout(Stdio::piped())
    .output()
    .map(|output|{
        format!("{}{}", 
            String::from_utf8(output.stderr).unwrap_or("".to_string()),
            String::from_utf8(output.stdout).unwrap_or("".to_string())
        ).find("ffmpeg").is_some()
    })
    .map_err(|e| e.to_string())
}

fn current_time() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs_f64()
}

pub mod lua_ffmpeg {
    use super::*;
    use std::io::{Write, BufReader, BufRead};
    use std::process::ChildStdin;
    use curl::easy::{Easy2, Handler};
    use ffmpeg_sidecar::command::FfmpegCommand;
    use ffmpeg_sidecar::child::FfmpegChild;
    // #[cfg(unix)]
    // use std::os::fd::{AsRawFd, OwnedFd, FromRawFd};
    // #[cfg(windows)]
    // use std::os::windows::io::{AsRawHandle, OwnedHandle, FromRawHandle};
    
    use rlua::prelude::{LuaResult, LuaContext, LuaError};
    use rlua::{Value, Table, UserData};
    use crate::filesystem::lua_filesystem::ConvertArgToString;
    use crate::image::lua_image::Image;

    struct FfmpegEncoder {
      inner: FfmpegChild,
    }
  
    impl FfmpegEncoder {
      pub fn from(mut child: FfmpegChild) -> Self {
        let stderr = BufReader::new(child.take_stderr().unwrap());
        
        std::thread::spawn(move || {
          stderr.lines().for_each(|line|
          println!("[FFMPEG.STDERR] {}", line.unwrap()));
        });
    
        FfmpegEncoder { inner: child }
      }
  
      pub fn get_stdin(&mut self) -> &ChildStdin {
        self.inner.as_inner().stdin.as_ref().unwrap()
      }
    }
  
    impl UserData for FfmpegEncoder {
      fn add_methods<'lua, T: rlua::UserDataMethods<'lua, Self>>(_methods: &mut T) {
        // encode a image frame, accept image userdata or png bytes
        _methods.add_method_mut("encode_frame", |_, encoder: &mut Self, img: Value|{
          let bytes = match img {
            Value::String(s)=> {
              s.as_bytes().to_vec()
            },
            Value::UserData(img)=> {
              match img.borrow::<Image>() {
                Ok(img)=> img.save_png_bytes(),
                Err(e)=> return Err(e)
              }
            },
            _ => return Err(LuaError::ToLuaConversionError { from: "(lua)", to: "image|png_bytes", message: None })
          };
          encoder.get_stdin()
            .write_all(bytes.as_ref())
            .map(|_| true)
            .map_err(|e| LuaError::RuntimeError(e.to_string()))
        });
        // close stdin pipe and wait ffmpeg process to exit
        _methods.add_method_mut("wait", |_, encoder: &mut Self, ()|{
          encoder.inner.wait()
            .map_err(|e| LuaError::RuntimeError(e.to_string()))
            .map(|v| v.success())
        });
      }
    }

    struct DownloadHandler {
        id: String,
        data: Vec<u8>,
        start: f64,
    }

    impl Handler for DownloadHandler {
        fn write(&mut self, data: &[u8]) -> Result<usize, curl::easy::WriteError> {
            match DOWNLOAD_STATE.lock().unwrap().entry(self.id.clone()) {
                Entry::Occupied(mut entry)=> {
                    let state = entry.get_mut();
                    self.data.extend_from_slice(data);
                    state.current_downloaded = self.data.len();
                    Ok(data.len())
                },
                Entry::Vacant(_)=> Ok(0)
            }
        }

        fn progress(&mut self, dltotal: f64, dlnow: f64, _: f64, _: f64) -> bool {
            match DOWNLOAD_STATE.lock().unwrap().entry(self.id.clone()) {
                Entry::Occupied(mut entry)=> {
                    let state = entry.get_mut();
                    state.current = dlnow;
                    state.total = dltotal;
                    state.start == self.start && state.status == "WORKING" // stop transferring if global state status was changed
                },
                Entry::Vacant(_)=> false // stop transferring if global state not exists
            }
        }
    }
    
    pub fn init(lua_ctx: LuaContext) -> LuaResult<()> {
        
    let table = lua_ctx.create_table()?;

    // create a new lua ffmpeg encoder
    //   bin      /usr/local/bin/ffmpeg
    //   path     xxxx/xxxx.mp4
    //   format   gif|mp4|mov
    //   scale    0.5|1
    //   rate     30
    table.set("Encoder", lua_ctx.create_function(|_, args: Table|{
        let bin = args.get::<_, String>("bin")?;
        let path = args.get::<_, String>("path")?;
        let format = args.get::<_, String>("format")?;
        let scale = args.get::<_, f32>("scale").unwrap_or(1.0);
        let rate = args.get::<_, f32>("rate").unwrap_or(30.0);

        let mut command = FfmpegCommand::new_with_path(bin);
        command.hide_banner()
            .args(["-r", rate.to_string().as_str()])
            .args(["-f", "image2pipe"])
            .args(["-i", "pipe:0"]);

        match &format[..] {
            "gif"=> (),
            "mp4"=> {
                command.args(["-vcodec", "h264", "-pix_fmt", "yuv420p",
                "-crf", "18", "-preset", "veryslow"]);
            },
            "mov"=> {
                command.args(["-vcodec", "png", "-pix_fmt", "rgba"]);
            },
            "debug"=> {
                command.args(["-vcodecdc"]);
            },
            s=> return Err(LuaError::RuntimeError(format!("Unsupported format: {}", s)))
        };

        let mut filters = Vec::new();
    
        if scale != 1.0 {
            filters.push(format!("scale={scale:.2}*iw:-1:flags=lanczos"));
        }
        if format.as_str() == "mp4" {
            // pad width and height to even number
            filters.push("pad=ceil(iw/2)*2:ceil(ih/2)*2".into());
        }
        else if format.as_str() == "gif" {
            // global palette
            filters.push("split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse".into());
        }
        
        if !filters.is_empty() {
            command.args(["-vf", filters.join(",").as_str()]);
        }

        command.args(["-y"]).output(path);

        command.print_command();
        // spawn child process
        match command.spawn() {
            Ok(process)=> Ok(FfmpegEncoder::from(process)),
            Err(e)=> Err(LuaError::RuntimeError(e.to_string()))
        }
    })?)?;

    table.set("ValidateBinPath", lua_ctx.create_function(|_, path: Value|{
        match path.to_string() {
            Ok(path)=> match run_version(path){
                Ok(v)=> {
                    Ok(if v { (true, "") } else { (false, "Interval error in running `$ffmpeg -version`")})
                        .map(|v| (v.0, v.1.to_string()))
                },
                Err(e)=> {
                    Ok( (false, e) )
                }
            },
            Err(e)=> Err(e)
    	}
    })?)?;
    lua_ctx.globals().set("FFcore", table)?;

    // _G.Downloader
    let table = lua_ctx.create_table()?;

    // start a new async download session
    table.set("Start", lua_ctx.create_function(|_, (id, url): (String, String)|{
        let mut state = DOWNLOAD_STATE.lock().unwrap();
        if let Some(state) = state.get(&id) {
            if state.status == "WORKING" {
                println!("Downloader session already exists: {}", &id);
                return Ok(false);
            }
        };

        let start = current_time();
        state.insert(id.clone(), DownloadState {
            id: id.clone(), 
            url: url.clone(), 
            start,
            current: 0.0, 
            total: 0.0, 
            current_downloaded: 0,
            status: "WORKING".into() ,
            data: Vec::new(),
        });
        // curl session
        let mut session = Easy2::new(DownloadHandler{
            id: id.clone(),
            start,
            data: Vec::with_capacity(28*1000*1000), 
        });
        session.url(url.as_str()).unwrap();
        session.progress(true).unwrap();
        session.follow_location(true).unwrap();
        session.ssl_verify_peer(false).unwrap();
        
        std::thread::spawn(move ||{
            session.perform().unwrap_or_else(|e| {
                DOWNLOAD_STATE.lock().unwrap().entry(id.clone())
                    .and_modify(|state| state.status = format!("ERROR {:?}", e));});
            
            DOWNLOAD_STATE.lock().unwrap().entry(id.clone())
                .and_modify(|state| {
                    if state.status.as_str() == "WORKING" {
                        state.data = session.get_ref().data.clone();
                        state.status = "FINISH".into()
                    }
            });
        });
        Ok(true)
    })?)?;

    // get session state by id 
    table.set("GetState", lua_ctx.create_function(|lua, id: String|{
        match DOWNLOAD_STATE.lock().unwrap().get(&id) {
            Some(state)=> {
                let result = lua.create_table()?;
                result.set("id", state.id.as_str())?;
                result.set("current", state.current)?;
                result.set("total", state.total)?;
                result.set("current_downloaded", state.current_downloaded)?;
                result.set("percent", state.current / state.total)?;
                result.set("url", state.url.as_str())?;
                result.set("status", state.status.as_str())?;
                Ok(Some(result))
            },
            None=> Ok(None),
        }
    })?)?;
    // get downloaded bytes
    table.set("GetData", lua_ctx.create_function(|lua, id: String|{
        match DOWNLOAD_STATE.lock().unwrap().get(&id) {
            Some(state)=> {
                Ok(Some(lua.create_string(state.data.as_slice())?))
            },
            None => Ok(None)
        }
    })?)?;
    // clear download bytes (free the memory)
    table.set("ClearData", lua_ctx.create_function(|_, id: String|{
        if let Some(state) = DOWNLOAD_STATE.lock().unwrap().get_mut(&id) {
            state.data.clear();
        };
        Ok(())
    })?)?;

    // cancel download session by id
    table.set("Cancel", lua_ctx.create_function(|_, id: String|{
        DOWNLOAD_STATE.lock().unwrap().entry(id.clone())
            .and_modify(|state| state.status = "CANCEL".into());
        Ok(()) 
    })?)?;
    lua_ctx.globals().set("Downloader", table)?;
    Ok(())

    }
}