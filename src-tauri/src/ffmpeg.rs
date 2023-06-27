use ffmpeg_sidecar;
use std::path::{Path, PathBuf};
use std::time::Duration;
use std::process::{Command, CommandArgs, Stdio};
use crate::unzip::unzip;
pub enum FfmpegPath {
  AppInstall(PathBuf),  // $AppData/bin/ffmpeg
  CustomInstall(PathBuf),  // ffmpeg or /usr/local/bin/ffmpeg
  Invalid,
}

pub struct FfmpegManager {
  path: FfmpegPath,
}

fn run_version(path: &Path) -> bool {
  Command::new(path)
    .arg("-version")
    .stderr(Stdio::null())
    .stdout(Stdio::null())
    .status()
    .map(|s| s.success())
    .unwrap_or_else(|_| false) 
}

impl FfmpegManager {
  pub fn new() -> Self {
    FfmpegManager { path: FfmpegPath::Invalid }
  }

  /// check ffmpeg exec
  pub fn check_custom_install(&mut self, path: &Path) -> bool {
    if run_version(path) {
      self.path = FfmpegPath::CustomInstall(path.to_path_buf());
      true
    }
    else{
      false
    }
  }
  
  /// check if ffmpeg is installed in the device ($AppData)
  pub fn check_app_install(&mut self, app_dir: &Path) -> bool {
    let mut path = app_dir.to_path_buf().join("bin").join("ffmpeg");
    if cfg!(windows) {
      path.set_extension("exe");
    }
    if path.is_file() {
      if run_version(&path) {
        self.path = FfmpegPath::AppInstall(path);
        true
      }
      else{
        false
      }
    }
    else{
      false
    }
  }

  /// download ffmpeg from public release
  pub fn download(&self, app_dir: &Path) -> Result<(), &'static str> {
    use curl::easy::Easy;

    let url = if cfg!(target_os = "windows") {
      ["https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-6.0-essentials_build.zip"]
    }
    else if cfg!(target_os = "macos") {
      ["https://evermeet.cx/ffmpeg/get/zip"]
    }
    else {
      [""]
    };

    if url[0].len() == 0 {
      return Err("Unsupported platform");
    }

    println!("Start downloading ffmpeg");
    for s in url {
      println!("Try url: {}", s);
      let mut buf = Vec::new();
      let mut session = Easy::new();
      session.url(s).unwrap();
      session.timeout(Duration::from_secs(60)).unwrap();
      session.progress(true).unwrap();
      session.follow_location(true).unwrap();
      session.progress_function(|a,b,_,_|{
        if a > 0.0 {
          println!("{}/{} ({}%)", b, a, b/a*100.0);
        }
        true
      }).unwrap();
      let mut trans = session.transfer();
      trans.write_function(|data|{
        buf.extend_from_slice(data);
        Ok(data.len())
      }).unwrap();
      trans.perform().unwrap();
    }

    println!("OK");
    Ok(())
  }
}