import os
import re

directory = 'c:/Users/VICTUS/OneDrive/Desktop/Water/client/src'

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(('.js', '.jsx')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Pattern: 'http://localhost:5000/api/...' or "http://localhost:5000/api/..." -> `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/...`
            # For strings in single or double quotes:
            content = re.sub(r"'http://localhost:5000(.*?)'", r"`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}\1`", content)
            content = re.sub(r'"http://localhost:5000(.*?)"', r"`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}\1`", content)
            
            # For backticks `http://localhost:5000...`
            content = content.replace("`http://localhost:5000", "`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}")
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
                
print("Frontend URLs updated!")
