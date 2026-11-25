"""Runs a shell in a pty, for the playground's dev server.

Frames come on stdin: a kind ("i" input, "r" resize), a 4-byte length and the payload. What the shell prints goes to
stdout as it is. Only Python's standard library, and only for development.
"""

import errno
import fcntl
import os
import pty
import select
import signal
import struct
import sys
import termios


def main():
    cols, rows, cwd = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    command = sys.argv[4:] or [os.environ.get("SHELL", "/bin/sh"), "-l"]
    pid, fd = pty.fork()
    if pid == 0:
        os.chdir(cwd)
        os.environ.update(TERM="xterm-256color", COLORTERM="truecolor", TERM_PROGRAM="workspace")
        os.execvp(command[0], command)

    def resize(c, r):
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", r, c, 0, 0))

    resize(cols, rows)
    buffer = b""
    while True:
        ready, _, _ = select.select([fd, 0], [], [])
        if fd in ready:
            try:
                data = os.read(fd, 65536)
            except OSError as error:
                if error.errno != errno.EIO:
                    raise
                data = b""
            if not data:
                break
            os.write(1, data)
        if 0 in ready:
            data = os.read(0, 65536)
            if not data:
                os.kill(pid, signal.SIGHUP)
                break
            buffer += data
            while len(buffer) >= 5:
                kind, length = buffer[:1], struct.unpack(">I", buffer[1:5])[0]
                if len(buffer) < 5 + length:
                    break
                payload, buffer = buffer[5 : 5 + length], buffer[5 + length :]
                if kind == b"i":
                    while payload:
                        payload = payload[os.write(fd, payload) :]
                elif kind == b"r":
                    resize(*struct.unpack(">HH", payload))
    _, status = os.waitpid(pid, 0)
    sys.exit(os.WEXITSTATUS(status) if os.WIFEXITED(status) else 1)


main()
