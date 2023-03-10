
Imagine you want to create your own browser application. Or any other application where you will execute code from unknown or untrusted sources. How can you run that code safely, without giving it access to personal data on the filesystem, and without borking other apps and data?

Essentially, we want to limit the power and access of the application and isolate it from other applications and data on the system. This concept is called sandboxing.

Even if you trust the code, providing isolation like this is super useful to be able to isolate problems. You can also avoid problems where one application needs a certain version of libA while another application needs a different version of libA. By isolating the filesystem access, different containers can install different versions of the same library without affecting each other.

Docker containers are a prime example of this.

## Plain old linux processes and users

Are linux processes not isolated from each other? In some ways, yes, a process provides some isolation, such as -
 - A process's virtual address space is fully isolated from another, so memory is isolated (unless explicitly using shared memory)
 - Processes have separate open file descriptors, independent current working directories etc. Processes cannot easily mess with each others state in general.

However, the filesystem is shared. Process can open, read and modify directories, files, named pipes, message queues etc. (those which the processes effective user has permission to access).

A process can easily get information about other processes by looking at /proc/ and further inspect and control them using ptrace system call. The ptrace() system call provides a means by which one process (the "tracer") may observe and control the execution of another process (the "tracee").
This system call is also used for implementing debuggers like gdb. Therefore, it is not far fetched that a rogue process can potentially mess with other processes if permissions are right, for e.g. changing the memory addresses and registers.

Also, the hardware resources such as CPU, RAM, network interfaces etc. are shared. So it is possible for one process to hoard compute resources.
A sufficiently priviliged process can change the system hostname, ip tables, network interfaces, firewall rules, occupy sockets/ports and so on.

Clearly plain processes are often not isolated enough for a lot of use cases.

## Why run untrusted code in priviliged mode?

A common thread in the above is that a process needs to have sufficient priviliges in order to do evil things. For e.g. in order to access a file, it must have the appropriate read, write and execute permissions for the user and group of the effective user of the process. For example:

```bash
$ ls -lsah ~/.ssh/authorized_keys
4.0K -rw-------  1 ubuntu ubuntu  406 Dec  3 12:57 authorized_keys
# can only by read and written to by processing running as user ubuntu (or root)

$ ls -lsah /etc/zshrc
4.0K -rw-r--r-- 1 root root 161 Dec  3 13:43 /etc/zshrc
# can be read by anyone but written to only by root

$ ps aux | grep -i my_executable
ubuntu     1227660  0.0  0.0   2828   356 pts/2    S+   21:43   0:00 ./_build/release/my_executable
# this process is running as ubuntu so it can read or write to the authorized_keys file
# but only read zshrc file, not write to it.
```

A process running as root will be able to do a lot of bad things to filesystem, system resources & other processes. Now the question, you might ask is: why not just run the process as a user with very little or no permissions (limited capabilities and limited filesystem access). Well, that is possible, but sometimes a process legitimately needs elevated access to perform its work. For e.g. - server software such as web servers or databases may require root-level access in order to listen on privileged ports or to access certain system resources. The traditional way this was done (and is still done quite widely) is to run the processes as root.

## Aside: setuid/setgid

Normally, a process gets the same access as the user who runs it. However, that is not always enough. Instead of giving a lot of privilieges to all users, there is an alternative. Binary executable files can be given special permission via setuid and setgid bit. So whenever they are executed, they get the same priviliges as the owner of the file, and not the user who is executing the file.

```bash
$ whoami
ubuntu

$ ls executable
16K -rwxr-xr-x 1 root root 16K Feb 27 01:38 executable*

$ ./executable
Hello world, Real uid = 1001 Effective uid = 1001

$ sudo chmod u+s executable

$ ls executable
16K -rwsr-xr-x 1 root root 16K Feb 27 01:38 memeater_executable*
# notice the executable bit is set to s instead of x
# this binary will now be run as root

$ ./executable
Hello World, Real uid = 1001, Effective uid = 0
# uid 0 denotes root
```

## Capabilities

Running processes as root (using setgid/setuid bit or running as root user) is often an all or nothing approach. That is not great. What if you wanted to give a process ability to do only one priviliged thing. In order to address this, linux divided the root powers into smaller units, called capabilities. If a process runs as root, it has all capabilities.

There are around 40 capabilities in total - e.g. CAP_SYS_TIME capability is needed to change system time, or CAP_SYS_PTRACE is needed to be able to call ptrace(2) system call and monitor memory of another process.

Below example shows how an executable can be granted capabilities, which will be inherited by the process when it is run by the user (depending on some rules, but we wont get into those details).

```bash
$ whoami
ubuntu

$ ls executable
16K -rwxr-xr-x 1 ubuntu ubuntu  16K Mar 10 22:53 executable*
# executable is a simple program which calls the nice system call

$ getcap executable

$ ./executable
Hello world, trying to lower nice value
Failed to set nice value: Operation not permitted

$ sudo setcap cap_sys_nice+eip executable

$ getcap executable
executable cap_sys_nice=eip

$ ./executable
Hello world, trying to lower nice value
Succeeded, bye
```

This is better than the "root or nothing" approach, but unfortunately there is still a big CAP_SYS_ADMIN capability which grants a large portion of power.

## High level structure

Now we have an idea of why we need more isolation, lets start to implement something using some primitives that linux provides:

- chroot
- namespaces
- cgroups
- seccommp
- LD_PRELOAD trick

There is 3 different ways, we can structure our sandbox:

 1. Have a separate binary for the sandbox which setups the sandbox and `exec`s the application. Then you would call your application like this.: `./sandbox ./my_app arg1 arg2`. Doing it this way is quite nice and flexible. This is kind of what docker does with its `docker run` command.

 ```c
 int main (int argc, char *argv[]) {
    setup_sandbox();
    execvp(argc, argv);
 }
 ```

 2. Have a single binary in which the main function sets up the sandbox before calling the applications code. This is the easiest one to develop with since everything is contained in a single executable but its not a good approach if you dont have access to the code of the application at sandbox compile time or if you want to use the sandbox for precompiled binaries.

 ```c
 #include "application.h"

 int main() {
    setup_sandbox();
    application_run();
 }
 ```

 3. Have a binary for the application and a shared library for the sandbox. Shared library overwrites the std library's entry point function and sets up the sandbox before calling the main function. Then the application can be run like this: `LD_PRELOAD=./sandbox.so ./my_app arg1 arg2`. (`LD_PRELOAD` is used to override symbols in the stock libraries by creating a library with the same symbols). This can be a ok approach but relies on overriding stdlibs main which can be a bit finnicky.

Since this is just a educational project, I am not worried about modularity or scalability of the sandbox to other apps, so I decided to go with approach#2 solely for ease of development.

For demo purposes, the `application_run` will be run both after and before the `setup_sandbox` and will print:

1) user & group id of the processes
2) process & parent process id
3) capabilities of the processes
4) contents of the root directory
5) other processes visible (list /proc/ basically)
6) network interfaces visible to the process.

We will also allocate large blocks of memory to see how the process behaves before and after the sandbox is setup.

Ok so the higher level flow of the `setup_sandbox()` function is as follows.

```c
void setup_sandbox(void) {
	printf("%s", "\n============== SETTING UP SANDBOX ===============\n");
	setup_cgroup();
	setup_namespaces();
	setup_mounts();
    fork_into_new_child_proc();
    // rest of the code runs in the child with pid 1
    mount_proc();
    setup_network_namespace();
    setup_seccomp();
}
```

But lets start by looking at chroot.

## chroot

This is a system call provided by the linux kernel.

```c
    if (chroot("/tmp/sandbox_tmp") != 0) {
        exit(EXIT_FAILURE);
    }
    if (chdir("/") != 0) {
        exit(EXIT_FAILURE);
    }
```

All future system calls will see "/tmp/sandbox_tmp" as the root "/". Therefore this provides the filesystem isolation which is a crucial element of our sandbox.

It is not fullproof and possible to escape this chroot jail using tricks mentioned in the [manual](https://man7.org/linux/man-pages/man2/chroot.2.html). Also, often this is not very flexible when used alone like this. What if you want to isolate the files produced by the sandboxed application from the processes running outside the sandbox? Or if you want to mount a new tmpfs just for this process? Or if you want to share (or bind mount) a local directory into the sandbox, like the `-v` or `--mount` option in docker - ` -v /data/dir/outside:/data/dir/inside_sandbox`. Lucky for us, Linux provides namespaces which can be used to solve these problems.

## namespaces

Linux namespaces are a mechanism provided by the kernel to make it appear to the processes that they have their own isolated instance of a particular global resource. There are 7 different type of namespaces, each isolating a different type of global resource:

 - UTS namespace - isolate hostname and NIS domain name
 - Mount namespace - isolate mounts
 - IPC namespace - isolate Message Queues (MQ), shared memory, semaphores
 - Network namespace - isolate network interfaces, ip adresses, routing tables, netfilter (firewall rules), socket-port number space, unix domain sockets
 - PID namespace - isolate process ids
 - Cgroup namespace - virtualize pathnames exposed in certain /proc/<PID> files that show cgroup membership of a process
 - User namespace - virtualize user and group ids (uid and gid)

Every process runs inside one instance of each namespace type. Most of the time its just the root namespace. But by moving a process or group of processes into a new namespace, we can provide isolation.

Lets try to see a couple of these in more details.

### Mount namespace

Using a mount namespace, it is possible to have processes in that namespace have its own mounts. A mount namespace can choose to not mount udev system on `/dev/`, hence taking away processes´s ability to open devices. Or you can mount a new tmp filesystem just for the processes in a namespace. In fact mount namespaces are often used alongside `chroot` in order to provide more control and flexibility over filesystem without affecting the filesystem of the root namespace.

```c

void setup_namespaces() {
    if (0 != unshare(CLONE_NEWUSER | CLONE_NEWNS | CLONE_NEWPID)) {
        printf("%s\n", "Error while unsharing into new user+mount+pid namespace");
        exit(EXIT_FAILURE);
    }
}
```

New namespaces can be created using `clone`, `unshare` system calls. In the snippet above, we specify the flags to move into a new mount namespace, as well as pid and user namespaces.

After that is done, we can manipulate the mounts in the namespace to our liking.

```c
// error handling removed for sake of compactness
void setup_mounts(void) {
    // use MS_PRIVATE flag to indicate that the file system mount should be
    // marked as private to the sandox's namespace.
    // It ensures that any subsequent mounts or unmounts made by the caller or
    // its children do not affect the same mount points in other namespaces
    int ret = mount(NULL, "/", NULL, MS_PRIVATE | MS_REC , NULL);

    // /tmp/sandbox_tmp outside will be root (i.e. /) inside sandbox
    char tmp_dir[] = "/tmp/sandbox_tmp";
    create_dir_if_not_exists(tmp_dir);
    // whatever was in /tmp/sandbox_tmp/ from before is still there
    // but have mounted a new tmpfs on top of it
    // so whatever was in there from before will
    // not be visible to sandbox anylonger
    ret = mount("tmpfs", tmp_dir, "tmpfs", 0, NULL);

    // if want to share a dir from outside into sandbox, can do something like this
    // /tmp/sandbox_tmp will become root / later so in order to make
    // the play dir accessible inside the sandbox as /my_play_dir
    // we create it in /tmp/sandbox_tmp/
    char common_dir[] = "/tmp/sandbox_tmp/my_play_dir";
    char play_dir_outside_sandbox[] = "/home/ubuntu/src/my_play_dir";
    create_dir_if_not_exists(common_dir);
    ret = mount(play_dir_outside_sandbox, common_dir, NULL, MS_BIND | MS_REC, NULL);

    // finally we chroot to /tmp/sandbox_tmp
    // code for chrooting (see above)
}
```

Comparing the contents of the root dir as visible to the application before and after setting up the sandbox shows us that it worked:

Before the sandbox is setup:
```
============== Root dir (/) ===============
  . (dir)
  run (dir)
  lib64 (link)
  sbin (link)
  media (dir)
  lib32 (link)
  nix (dir)
  sys (dir)
  opt (dir)
  bin (link)
  snap (dir)
  libx32 (link)
  etc (dir)
  var (dir)
  lost+found (dir)
  proc (dir)
  .. (dir)
  srv (dir)
  boot (dir)
  root (dir)
  tmp (dir)
  lib (link)
  usr (dir)
  mnt (dir)
  home (dir)
  dev (dir)
```

After the sandbox is setup:
```
============== Root dir (/) ===============
  . (dir)
  .. (dir)
  proc (dir)
  my_play_dir (dir)
```

### PID namespace

If you notice carefully we called `unshare` with `CLONE_NEWPID` flag as well. In case of pid namespaces, the unshare call does not move the process into the new namespace. Instead the first child process cloned from this process will be the init process (pid 1) in the new namespace.

So we fork our current process and the parent process does nothing except wait for the child to finish, while child process continues and executes the rest of the sandbox and the application code.

```c
void fork_into_new_child_proc(void) {
	printf("Forking into new child with pid 1\n");
	// need to move the current process into the new pid namespace manually
	// unshare creates the pid namespace without automatically moving current
	// process into that namespaces
	// the first child of the current process (after unshare has been called)
	// will be pid 1 in the new namespace

	pid_t res_pid = fork();
	if (res_pid == 0) {
		// child process
		puts("Inside child process");
		// just continue with the rest of the program flow
        return;
	} else {
		// parent process
		puts("Inside parent process, waiting for child to finish up");
		int status = -1;
		waitpid(res_pid, &status, 0);
		if (WIFEXITED(status)) {
			exit(WEXITSTATUS(status));
		} else {
			puts("Child process didnt exit normally");
			exit(EXIT_FAILURE);
		}
	}
}
```

And since we are in a new PID namespace, lets see what effect this has on the the pids visible to the process under the proc filesystem at `/proc`:

Before the sandbox:

```
============== All PIDs ===============
  1 (dir)
  2 (dir)
  3 (dir)
  4 (dir)
  5 (dir)
    .
    .
    .
  1228574 (dir)
  1228575 (dir)
  1228576 (dir)
  1228577 (dir)
```

After the sandbox is setup:
```
============== All PIDs ===============
  1 (dir)
```

And that process with pid 1 is ofcourse the sandbox+application process. Note that this is the child process. The parent process continues to remain in the original pid namespace.

### Manipulating environment variables

It is worth mentioning that nix is a build tool but with nix-shell, just by manipulating the environment variables like the PATH, LD_LIBRARY_PATH etc, it provides meaningful, albeit leaky, isolation at runtime. It is a useful means of isolation because it is very simple. Although it should obviously be used only if you trust the application to respect the environment variables and not escape the filmsy sandbox. But the effectiveness of `nix-shell` tells me that it is effective in scenarios such as development environments.
