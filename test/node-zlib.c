#define _GNU_SOURCE
#include <assert.h>
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>
#include <node_api.h>
#include "gzguts.h"

/* Resolve only the running executable's bundled implementation, never libz. */
static void *symbol(const char *name) {
    void *address = dlsym(RTLD_DEFAULT, name);
    Dl_info info;
    struct stat binary, owner;
    assert(address && dladdr(address, &info));
    assert(stat("/proc/self/exe", &binary) == 0 && stat(info.dli_fname, &owner) == 0);
    assert(binary.st_dev == owner.st_dev && binary.st_ino == owner.st_ino);
    return address;
}

static napi_value init(napi_env env, napi_value exports) {
    (void)exports;
    gzFile (*open_fd)(int, const char *) = symbol("gzdopen");
    int (*buffer)(gzFile, unsigned) = symbol("gzbuffer");
    int (*write_gz)(gzFile, voidpc, unsigned) = symbol("gzwrite");
    int (*print_gz)(gzFile, const char *, ...) = symbol("gzprintf");
    void (*clear_error)(gzFile) = symbol("gzclearerr");
    int (*close_gz)(gzFile) = symbol("gzclose");
    const char *(*error_gz)(gzFile, int *) = symbol("gzerror");
    char result[128];
    int reset[2];
    signal(SIGPIPE, SIG_IGN);
    for (int nonblocking = 0; nonblocking < 2; nonblocking++) {
        int pipe_fd[2];
        assert(pipe(pipe_fd) == 0);
        char input[4096];
        memset(input, 'a', sizeof(input));
        if (nonblocking) {
            assert(fcntl(pipe_fd[1], F_SETFL, O_NONBLOCK) == 0);
            while (write(pipe_fd[1], input, sizeof(input)) > 0) {}
            assert(errno == EAGAIN);
        } else assert(close(pipe_fd[0]) == 0);
        gzFile file = open_fd(pipe_fd[1], "wT");
        assert(file && buffer(file, 64) == 0);
        errno = 0;
        assert(write_gz(file, input, sizeof(input)) == 0);
        int saved_errno = errno, error = 0;
        error_gz(file, &error);
        gz_statep state = (gz_statep)file;
        assert(error == Z_ERRNO && saved_errno == (nonblocking ? EAGAIN : EPIPE));
        assert(!!state->again == nonblocking);
        reset[nonblocking] = state->strm.avail_in == 0 && state->strm.next_in == state->in;
        if (!reset[nonblocking])
            assert(state->strm.next_in == (Bytef *)input && state->strm.avail_in == sizeof(input));
        /* Never reenter printf with a known stale pointer in the negative control. */
        if (reset[nonblocking]) {
            if (nonblocking) {
                assert(fcntl(pipe_fd[0], F_SETFL, O_NONBLOCK) == 0);
                while (read(pipe_fd[0], input, sizeof(input)) > 0) {}
                assert(errno == EAGAIN);
            }
            clear_error(file);
            assert(print_gz(file, "%s", "safe") == 4);
            assert(state->strm.next_in == state->in && state->strm.avail_in == 4);
        }
        int closed = close_gz(file);
        if (reset[nonblocking]) assert(closed == (nonblocking ? Z_OK : Z_ERRNO));
        if (nonblocking) assert(close(pipe_fd[0]) == 0);
    }
    snprintf(result, sizeof(result), "{\"EPIPE\":\"%s\",\"EAGAIN\":\"%s\"}",
             reset[0] ? "reset" : "stale", reset[1] ? "reset" : "stale");
    napi_value value;
    assert(napi_create_string_utf8(env, result, NAPI_AUTO_LENGTH, &value) == napi_ok);
    return value;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
