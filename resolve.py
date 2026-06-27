import os
import subprocess
import re

files = subprocess.check_output(['git', 'diff', '--name-only', '--diff-filter=U']).decode().split()

for f in files:
    if not f.strip():
        continue
    with open(f, 'r') as file:
        content = file.read()
    
    content = re.sub(r"<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> upstream/main\n", r"\1\n", content, flags=re.DOTALL)
    
    with open(f, 'w') as file:
        file.write(content)
