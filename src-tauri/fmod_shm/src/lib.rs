mod fmod;
use std::{collections::HashMap, io::Write};
use std::io::{Cursor, Read};

use shared_memory::{ShmemConf, Shmem};

#[repr(C)]
pub enum StatusCode {
    FailedToInit,
    ParentWriting,
    ParentReading,
    ParentDrop,
    ChildWriting,
    ChildReading,
}

#[derive(Default)]
pub struct Message {
    cmd: String,
    args: Vec<String>,
    kwargs: HashMap<String, String>,
}

fn dump_len(len: usize) -> [u8; 2] {
    u16::to_le_bytes(len as u16)
}

fn read_len(mut reader: impl Read) -> usize {
    let mut buf = [0, 0];
    match reader.read_exact(&mut buf) {
        Ok(_)=> u16::from_le_bytes(buf) as usize,
        Err(_)=> usize::MAX,
    }
}

fn read_bytes(mut reader: impl Read, len: usize) -> Vec<u8> {
    let mut buf = Vec::with_capacity(len);
    match reader.read_exact(&mut buf) {
        Ok(_)=> buf,
        Err(_)=> Vec::new(),
    }
}

impl Message {
    // fn dump_len<T>(len: T) -> [u8; 2] {
    //     u16::to_le_bytes(len as u16)
    // }

    fn se(&self) -> Vec<u8> {
        let mut buf = Cursor::new(Vec::<u8>::new());
        // cmd
        buf.write(&dump_len(self.cmd.as_bytes().len())).unwrap();
        buf.write(self.cmd.as_bytes()).unwrap();
        // args
        buf.write(&dump_len(self.args.len())).unwrap();
        self.args.iter()
            .for_each(|v|{
                buf.write(&dump_len(self.args.len())).unwrap();
                buf.write(v.as_bytes()).unwrap();
            });
        // kwargs

        Vec::<u8>::from(buf.get_ref().as_slice())
    }

    fn de(mem: &[u8]) -> Self {
        let mut msg = Message::default();
        let mut reader = Cursor::new(mem);
        
        // cmd
        let cmd_len = read_len(&mut reader);
        // msg.cmd = String::from(read_bytes(&mut reader, cmd_len).as_slice());

        msg

    }
}

const MEM_SIZE: usize = 65535;
pub struct MessageHandler {
    shm_name: String,
    shm: Shmem,
}

impl MessageHandler {
    // fn new()
}
pub fn add(left: usize, right: usize) -> usize {
    left + right
}

pub fn t() -> String {
    "123".to_string().as_bytes();
    format!("111")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
