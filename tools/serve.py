"""Vietinis svetainės serveris peržiūrai (http://localhost:8077). index.php rodomas kaip HTML (PHP nevykdomas)."""
import http.server
import os
import sys
from pathlib import Path

os.chdir(Path(__file__).resolve().parent.parent.parent)          # <site folder>
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):          # pythonw neturi konsolės — žurnalas į stderr nulaužtų atsakymą
        pass


H.extensions_map['.php'] = 'text/html'
H.extensions_map['.js'] = 'text/javascript'
H.extensions_map['.mjs'] = 'text/javascript'
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8077), H).serve_forever()
