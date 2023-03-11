
Imagine you want to create your own browser application. Or any other application where you will execute code from unknown or untrusted sources. How can you run that code safely, without giving it access to personal data on the filesystem, and without borking other apps and data?

Essentially, we want to limit the power and access of the application and isolate it from other applications and data on the system. This concept is called sandboxing.

Even if you trust the code, providing isolation like this is super useful to be able to avoid problems where one application needs a certain version of libA while another application needs a different version of libA. By isolating the filesystem access, different processes can use different versions of the same library without affecting each other.

Docker containers are a prime example of this.

## Plain old linux processes and users

Are linux processes not isolated from each other? In some ways, yes, a process provides some isolation, such as -
 - A process's virtual address space is fully isolated from another, so memory is isolated (unless explicitly using shared memory)
 - Processes have separate open file descriptors, independent current working directories etc. Processes cannot easily mess with each others state in general.

However, the filesystem is shared. Process can open, read and modify directories, files, named pipes, message queues etc. (those which the process's effective user has permission to access).

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

- chroot system call
- namespaces
- cgroups
- seccommp

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

Since this is just an educational project, I am not worried about modularity or scalability of the sandbox to other apps, so I decided to go with approach#2 solely for ease of development.

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

## Namespaces

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

After that is done, we can manipulate the mounts in the namespace to our liking. For e.g - we mount a new tmpfs as the root (/) in our sandbox and we share a directory between the sandbox and the outside world, which whill be `/play_dir` in the sandbox and `/home/ubuntu/src/my_play_dir` outside the sandbox.

```c
// error handling removed for sake of compactness
void setup_mounts(void) {
    // use MS_PRIVATE flag to indicate that the file system mount should be
    // marked as private to the sandox's namespace.
    // It ensures that any subsequent mounts or unmounts made by the caller or
    // its children do not affect the same mount points in other namespaces
    mount(NULL, "/", NULL, MS_PRIVATE | MS_REC , NULL);

    // /tmp/sandbox_tmp outside will be root (i.e. /) inside sandbox
    char tmp_dir[] = "/tmp/sandbox_tmp";
    create_dir_if_not_exists(tmp_dir);
    // whatever was in /tmp/sandbox_tmp/ from before is still there
    // but have mounted a new tmpfs on top of it
    // so whatever was in there from before will
    // not be visible to sandbox anylonger
    mount("tmpfs", tmp_dir, "tmpfs", 0, NULL);

    // if want to share a dir from outside into sandbox, can do something like this
    // /tmp/sandbox_tmp will become root / later so in order to make
    // the play dir accessible inside the sandbox as /my_play_dir
    // we create it in /tmp/sandbox_tmp/
    char common_dir[] = "/tmp/sandbox_tmp/my_play_dir";
    char play_dir_outside_sandbox[] = "/home/ubuntu/src/my_play_dir";
    create_dir_if_not_exists(common_dir);
    mount(play_dir_outside_sandbox, common_dir, NULL, MS_BIND | MS_REC, NULL);

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

After the sandbox is setup (later, we will talk about how `/proc` is here):
```
============== Root dir (/) ===============
  . (dir)
  .. (dir)
  proc (dir)
  my_play_dir (dir)
```

### PID namespace

If you notice carefully we called `unshare` with `CLONE_NEWPID` flag as well. In case of pid namespaces, the unshare call does not move the process into the new namespace, it only creates the namespace. Instead the first child process forked from this process will be the init process (pid 1) in the new namespace.

So we fork our current process and the parent process does nothing except wait for the child to finish, while child process continues and executes the rest of the sandbox and the application code.

```c
void fork_into_new_child_proc(void) {
	printf("Forking into new child with pid 1\n");

	pid_t res_pid = fork();
	if (res_pid == 0) {
		puts("Inside child process");
		// just continue with the rest of the program flow
        return;
	} else {
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

If we look at the PIDs before setting up the namespace

```
============== IDs ===============
Process Id (PID) = 1235968
Parent Process Id (PPID) = 1235967
```

And compare it with the PIDs printed after process is moved into the new PID namespace:

```
============== IDs ===============
Process Id (PID) = 1
Parent Process Id (PPID) = 0
```

We can clearly see that the pid namespace is set up correctly and the process is the init process in the new namespace.

And since we are in a new PID namespace, lets see what effect this has on the the pids visible to the process under the proc filesystem at `/proc`. But wait, we dont have access to /proc since we did chroot to a new temporary directory. And even if we did have access to old /proc, we want to remount it anyway because dont want to look at the /proc mounted by the root pid namespace.

So lets do that:

```c
void mount_proc(void) {
	// mount /proc
	// make sure that we are in a new pid namespace while running
	printf("Mounting /proc\n");
    create_dir_if_not_exists("/proc");
    mount("proc", "/proc", "proc", 0, NULL);
}
```

And printing the pids visible under /proc, we can see that before the sandbox all the pids are visible as normal:

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

But after the sandbox is setup, we only see a single process there:
```
============== All PIDs ===============
  1 (dir)
```

And that process with pid 1 is ofcourse the sandbox+application process. Note that this is the child process created after the fork call above. The parent process continues to remain in the original pid namespace.

### Network namespace

Lets also unshare into a new network namespace.

 Why did we not do this together with the `unshare` call earlier where we created new mount, pid and user namespaces? The reason is that we want to move into a new network namespace only after having forked into a new child process. This can, in theory, allow us access to the sandbox network namespace in the child process and allow access to the root network namespace in the parent process. We are able to setup a bridge between the two namespaces (using iptables magic for e.g.), which is useful if we want to give internet access to the sandboxed process.

```
void setup_network_namespace(void) {
	printf("%s", "\n============== Network Namespace ===============\n");
    unshare(CLONE_NEWNET)) {
}
```

Very simple indeed. Lets look at the network interfaces visible to the process before and after setting up the sandbox:

```
============== Network Interfaces ===============
lo       AF_PACKET (17)
                tx_packets =     627442; rx_packets =     627442
                tx_bytes   =   95995046; rx_bytes   =   95995046
ens3     AF_PACKET (17)
                tx_packets =    9690900; rx_packets =   10793640
                tx_bytes   = 4183933301; rx_bytes   = 1574657159
lo       AF_INET (2)
                address: <127.0.0.1>
ens3     AF_INET (2)
                address: <10.0.0.58>
lo       AF_INET6 (10)
                address: <::1>
ens3     AF_INET6 (10)
                address: <fe80::17ff:fe17:620e%ens3>

```

And after setting up the new network namespace, only the loopback network interface is visible. This means that the process does not have internet access in the sandbox.

```
============== Network Interfaces ===============
lo       AF_PACKET (17)
                tx_packets =          0; rx_packets =          0
                tx_bytes   =          0; rx_bytes   =          0
```

### User namespace

This one is a tiny bit more complex than the other namespaces. A process's uid and gid can be different inside and outside user namespace. A common use case is that a process has normal unpriviliged id outside the namespace but inside the namspace it has uid 0 (a priviliged superuser process).
When a new user namespace is created, the first process in that namespace has all the capabilities and superuser power, but only inside the namespace. What does that mean? Thats the goal to understand.

Lets look at an example:

`/proc/<PID>/uid_map` and `/proc/PID/gid_map` maps define what the uids and gids inside a namespace correspond to uid and gid outside the namespace

We can write to these files. The contents of these files is lines of the form
```<id inside namespace> <id outside namespace> <length of range>```

e.g. root mapping `0 1000 1` maps 0 inside namespace maps to 1000 outside

We can check `/proc/pid/status` inside the process after moving into this new namespace and it will show that it has full 38 capabilities.

But if we try to change system hostname from within this process in the new user namespace (where local uid is 0, and it has root powers), it will still fail. Why? Because the process still resides in the original UTS namespace. Lets look at this more.

### User namespaces and capabilities

Each non-user namespace instance (e.g. a UTS namespace) is owned by a user namespace instance. When a new nonuser namespace is created it gets owned by the user namespace of the calling process's user namespace.

If process operates on resources governed by non-user namespace, permission checks are done according to process's capabilities in the user namespace that owns the non-user namespace.

Uff, thats a mouthful. Reread this multiple times or watch [this excellent video](https://www.youtube.com/watch?v=73nB9-HYbAI) by Michael Kerrisk about user namespaces if you dont get it.

### Implementing a user namespace

In the `setup_namespaces` function earlier, we specified the `CLONE_NEWUSER` flag, so the process does indeed move into a new user namespace.

We are running the process as root before the sandbox is setup. So initially the process has uid 0 and gid 0.

```
============== IDs ===============
Real uid = 0
Effective uid = 0
Real gid = 0
Effective gid = 0
```

The reason for doing this is to be able to have enough permission to move the process into a new cgroup (which we will talk about later).

And we also did setup a root uid and gid mapping, so that we get uid 0 in the sandbox. If we look at the uid and gid after and before, setting up the sandbox, its identical to before the sandbox.

But we can compare the capabilities. Before the sandbox:

```
============== Capabilities ===============
cap_dac_override,cap_setfcap=eip
```

I dropped all capabilities except the ones which were required for cgroups. So we only see two capabilities before the sandbox.
And after the sanbox is set up:

```
============== Capabilities ===============
=ep
```

This is equivalent to all superuser capabilities. So the sandbox has all capabilities, but only for resources owned by the new user namespace. It cannot mess with resources which are owned by the original user namespace, which the new user namespace does not own (such as the hostname, since we did not move into a new UTS namespace),

## Seccomp

Seccomp bpf (short for secure computing mode) is a computer security facility in the Linux kernel. It allows a process to make a one-way transition into a "secure" state where it cannot make any system calls except those which are explicitly allowlisted.

It does this using Berkeley Packet Filtering. BPF is an in kernel programing language with an interpreter and jit compiler inside kernel. It basically allows to change how kernel behaves. There is a higher level library called libseccomp, which simplifies the process of setting up seccomp, so we dont have to fiddle with BPF. Lets look at some code:

```c
void allow(scmp_filter_ctx ctx, int syscall) {
	seccomp_rule_add(ctx, SCMP_ACT_ALLOW, syscall, 0);
}

void setup_seccomp(void) {
	printf("%s", "\n============== Seccomp ===============\n");
	scmp_filter_ctx ctx = seccomp_init(SCMP_ACT_KILL);

	allow(ctx, SCMP_SYS(open));
	allow(ctx, SCMP_SYS(openat));
    .
    .
    .
    allow(ctx, SCMP_SYS(close));
    allow(ctx, SCMP_SYS(write));
    allow(ctx, SCMP_SYS(read));

	seccomp_load(ctx);
	seccomp_release(ctx);
}
```

Whitelisting syscalls such as `open`, `read` allows the sandbox process to read files and directories in its filesystem. There are many other syscalls that are not shown here that I had to whitelist for the sandbox to work.

After moving into the sandbox, if the process were to make a system call which is not whitelisted, the process will be killed.

## Cgroups (v2)

Cgroups is a facility provided by the linux kernel for resource management. A cgroup is a group of processes bound together for resource management. It contains multiple resource controllers. A resource controller is a kernel component that controls or monitors processes in a group - e.g. - memory controller, cpu controller, network controller.

Cgroups allow us to limit resource usage, prioritize resources for certain groups, monitor resource usage and so on.

To work with cgroups, we simply need to interact with filesystem, mainly under /sys/fs/cgroup and /proc

To check cgroup of a process:
`cat /proc/<PID>/cgroup`

To create a new cgroup
`mkdir mygroup`

Creating a cgroup like this will also automatically create dirs and files inside `/sys/fs/cgroup/mygroup` which can be used to manage the cgroup and move processes into it.

```
$ ls /sys/fs/cgroup/mygroup
total 0
0 drwxr-xr-x 2 root root 0 Mar  9 18:34 ./
0 drwxr-xr-x 3 root root 0 Feb 27 00:33 ../
0 -r--r--r-- 1 root root 0 Mar  9 18:34 cgroup.controllers
0 -r--r--r-- 1 root root 0 Mar 11 12:10 cgroup.events
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 cgroup.freeze
0 --w------- 1 root root 0 Mar 11 12:10 cgroup.kill
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 cgroup.max.depth
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 cgroup.max.descendants
0 -rw-r--r-- 1 root root 0 Mar 11 10:58 cgroup.procs
0 -r--r--r-- 1 root root 0 Mar 11 12:10 cgroup.stat
0 -rw-r--r-- 1 root root 0 Mar  9 18:34 cgroup.subtree_control
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 cgroup.threads
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 cgroup.type
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 cpu.pressure
0 -r--r--r-- 1 root root 0 Mar 11 12:10 cpu.stat
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 io.pressure
0 -r--r--r-- 1 root root 0 Mar 11 12:10 memory.current
0 -r--r--r-- 1 root root 0 Mar 11 12:10 memory.events
0 -r--r--r-- 1 root root 0 Mar 11 12:10 memory.events.local
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 memory.high
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 memory.low
0 -rw-r--r-- 1 root root 0 Mar 11 10:58 memory.max
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 memory.min
0 -r--r--r-- 1 root root 0 Mar 11 12:10 memory.numa_stat
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 memory.oom.group
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 memory.pressure
0 -r--r--r-- 1 root root 0 Mar 11 12:10 memory.stat
0 -r--r--r-- 1 root root 0 Mar 11 12:10 memory.swap.current
0 -r--r--r-- 1 root root 0 Mar 11 12:10 memory.swap.events
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 memory.swap.high
0 -rw-r--r-- 1 root root 0 Mar 11 12:10 memory.swap.max
```

These are not regular files stored in hard disk, they are made by the kernel whenever a read or write request is made to them.

To move a process into mygroup cgroup, simply write the pid into cgroup.procs file.

`echo 2345 > /sys/fs/cgroup/mygroup/cgroup.procs`

We could have created a new cgroup inside our `setup_sandbox` function itself, but for sake of simplicity, we will create it before running our application and simply pass the name of the cgroup as an environment variable into the process.

So, lets manually create a new cgroup which the sandboxed process can be moved into.

```bash
sudo mkdir /sys/fs/cgroup/my_sandbox
# enable memory controller
echo "+memory" | sudo tee /sys/fs/cgroup/my_sandbox/cgroup.subtree_control
sudo mkdir /sys/fs/cgroup/my_sandbox/leaf

sudo chown -R ubuntu:ubuntu /sys/fs/cgroup/my_sandbox
```

Now, inside `setup_sandbox`, we will simply specify the maximum amount of memory that this cgroup is allowed to consume before it is killed. In our case, this limit is 12 MB.

```c
void setup_cgroup(void) {
	printf("%s", "\n============== Cgroup ===============\n");

    char* sandbox_cgroup_dir = getenv("SANDBOX_CGROUP_DIR");
    char* memory_max_fname;
	asprintf(&memory_max_fname, "%s/memory.max", sandbox_cgroup_dir);
	write_to_file(memory_max_fname, "12000000");

    char* cgroup_procs_fname;
	asprintf(&cgroup_procs_fname, "%s/cgroup.procs", sandbox_cgroup_dir);

	pid_t my_pid = getpid();
	char* pid_str;
	asprintf(&pid_str, "%u", my_pid);

	write_to_file(cgroup_procs_fname, pid_str);

	free(cgroup_procs_fname);
	free(pid_str);
}
```

Now we can observe what happens if we have a simple function which allocates large amounts of memory:

```c
void allocate_large_mem(void) {
	printf("%s", "\n============== Memory test ===============\n");
	printf("%s\n", "Attempting to allocate large amounts of memory");
    size_t n_blocks = 4;
    size_t block_size = 1024*1024*4;
    printf("I will eat memory in %zu blocks of size %zu\n", n_blocks, block_size);
    printf("Press any key to continue\n");
    getchar();
    uint8_t* buf[n_blocks];
    for (size_t i=0; i<n_blocks; i++) {
        buf[i] = (uint8_t*) calloc(block_size, 1);
        if (buf[i] == NULL) {
            printf("%s\n", "Error while calling calloc");
            perror("calloc");
            exit(EXIT_FAILURE);
        }
        printf("allocated block# i=%zu, filling it with rand data now\n", i);
        for (size_t j=0; j<block_size; j++) {
            buf[i][j] = rand() * UINT8_MAX;
        }
    }
    printf("Press any key to continue to the end\n");
    getchar();
    for (size_t i=0; i<n_blocks; i++) {
        uint8_t sum = 0;
        for (size_t j=0; j<block_size; j++) {
            sum += buf[i][j];
        }
        printf("sum at index i=%zu is %hhu\n", i, sum);
        free(buf[i]);
    }
    puts("releasing allocated memory\n");
}
```

This function will attempt to allocate 4 x 4 MB memory. Calling this function before setting up the sandbox succeeds normally.

```
============== Memory test ===============
Attempting to allocate large amounts of memory
I will eat memory in 4 blocks of size 4194304
Press any key to continue

allocated block# i=0, filling it with rand data now
allocated block# i=1, filling it with rand data now
allocated block# i=2, filling it with rand data nowhttps://blog.lizzie.io/linux-containers-in-500-loc.html
allocated block# i=3, filling it with rand data now
Press any key to continue to the end

sum at index i=0 is 238
sum at index i=1 is 103
sum at index i=2 is 109
sum at index i=3 is 191
releasing allocated memory
```

But after setting up the sandbox, it succceeds in allocating 3 x 4 MB blocks but is killed by the cgroup memory controller when it tries to allocate the fourth block because the 12MB memory limit is exceeded.

```
============== Memory test ===============
Attempting to allocate large amounts of memory
I will eat memory in 4 blocks of size 4194304
Press any key to continue

allocated block# i=0, filling it with rand data now
allocated block# i=1, filling it with rand data now
allocated block# i=2, filling it with rand data now
Exiting parent process
Child process didnt exit normally
```

This type of resource limitting can also be done for cpu usage, disk io, network io etc.

## Conclusion

We looked at how linux primitives can be used to make sandboxes. There is other resources if you want to learn more. If you want to make a more user friendly sandbox which is similar to docker and allows creating and saving images - have a look at [containers in 500 lines of code by lizzie](https://blog.lizzie.io/linux-containers-in-500-loc.html).

You can also have a look at [this ACCU conference talk](https://www.youtube.com/watch?v=a6JM7FmtEt4) by my colleague Martin Ertsås. In fact, his talk was a major inspiration for me to explore sandboxing and write this post.

