import sys
import time
import logging
import subprocess
from pathlib import Path

from watchdog.observers import Observer
from watchdog.events import LoggingEventHandler

class MyHandler(LoggingEventHandler):
	def on_modified(self, event):
		path = event.src_path
		if "output" in path or "DS_Store" in path:
			# don't watch output file change
			return 
		print(event)
		super(LoggingEventHandler, self).on_modified(event)
		p = subprocess.run(["./target/release/asset-archive", "c"])#, text = True, capture_output = True)
		# print(p.stdout)
		# print(p.stderr)

logging.basicConfig(level = logging.INFO, format = "%(asctime)s %(message)s")
observer = Observer()
path = Path(__file__).resolve().parent.parent.parent

print("Watching: ", path)
observer.schedule(MyHandler(), path, recursive = True)
observer.start()

while True:
	time.sleep(1)
