// audio device tracker

#[cfg(target_os = "macos")]
use coreaudio::audio_unit::macos_helpers::{get_default_device_id, get_device_name};

#[cfg(windows)]
use cpal::traits::{DeviceTrait, HostTrait};

#[cfg(target_os = "macos")]
fn get_default_output_device() ->String {
  match get_default_device_id(false /* output device */) {
    Some(id) => {
      match get_device_name(id) {
        Ok(name)=> format!("{} [{}]", name, id),
        Err(_)=> format!("Unknown device [{}]", id)
      }
    },
    None => format!("Unknown device [-1]")
  }
}

#[cfg(windows)]
fn get_default_output_device() ->String {
    match cpal::default_host().default_output_device() {
      Some(device)=> device.name().unwrap_or_else(|_| "Unknown device [-1]".to_string()),
      None => format!("Unknown device [-1]")
    }
}

use std::time::{Instant, Duration};
use std::thread;

pub fn start_tracking<F>(on_change: F)
where F: Fn(&str) + Send + 'static {
  thread::spawn(move||{
    let mut current_device = get_default_output_device();
    let mut last_change_time = Instant::now();
    let mut pending = false;
      loop {
        let v = get_default_output_device();
        if v != current_device {
          current_device = v;
          pending = true;
          last_change_time = Instant::now();
        }
        if pending && last_change_time.elapsed() >= Duration::from_millis(500) {
          pending = false;
          on_change(current_device.as_str());
        }
        thread::sleep(Duration::from_millis(100));
      }
    });
}