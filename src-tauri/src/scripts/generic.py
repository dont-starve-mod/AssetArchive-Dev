import os
import sys
from pathlib import Path

for p in Path(".").iterdir():
	if p.is_file():
		print(p)