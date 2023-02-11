
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
This system call is also used for implementing debuggers like gdb. Therefore, it is not far fetched that a rogue process can potentially mess with other processes if permissions are right, for e.g. changing the memory addresses and register.

Also, the hardware resources such as CPU, RAM, network interfaces etc. are shared. So it is possible for one process to hoard compute resources.
A sufficiently priviliged process can change the system hostname, ip tables, network interfaces, firewall rules, occupy sockets/ports and so on.

Clearly plain processes are often not isolated enough.

## Why run untrusted code in priviliged mode?

A common thread in the above is that a process needs to have sufficient priviliges in order to do evil things. For e.g. a process running as root will be able to do a lot of bad things to other.

Now the question, you might ask is: why not just run the process as a user with very little or no permissions (limited capabilities and limited filesystem access). Well, that is possible, but sometimes a process legitimately needs elevated access to perform its work. The traditional way this was done (and is still done quite widely) is to run the processes as root.

## Aside: setuid/setgid

Normally, a process gets the same access as the user who runs it. However, that is not always enough. Instead of giving a lot of privilieges to all users, there is an alternative. Binary executable files can be given special permission via setuid and setgid bit. So whenever they are executed, they get additional root priviliges that the user who ran them might not have.

```bash
NEEDS CODE EXMAPLE
```

## Capabilities

Running processes as root (using setgid/setuid bit or running as root user) is often an all or nothing approach. That is not great. What if you wanted to give a process ability to do only one priviliged thing, which is be able to set process scheduling priority. In order to address this, linux divided the root powers into smaller units, called capabilities. If a process runs as root, it has all capabilities.

There are around 40 capabilities in total - e.g. CAP_SYS_TIME capability is needed to change system time.
Unfortunately there is still a big CAP_SYS_ADMIN capability which grants a large portion of power.

```bash
needs code
```

Now we have an idea of why we need more isolation, lets start to implement something using some primitives that linux provides:

- chroot
- namespaces
- cgroups
- seccommp
- LD_PRELOAD trick

## High level structure

There is 3 different ways, we can go about this, depending on the use case:

 1. Have a separate binary for the sandbox which setups the sandbox and `exec`s the application. Then you would call your application like this.: `./sandbox ./my_app arg1 arg2`. Doing it this way is quite nice and flexible. This is kind of what docker does with its `docker run` command.

 ```c
 int main (int argc, char *argv[]) {
    setup_sandbox();
    execvp(argc, argv);
 }
 ```

 2. Have a single binary in which the main function sets up the sandbox before calling the applications code. This is the easiest one to develop with since everything is contained in a single executable but its not a good approach if you dont have access to the code of the application at sandbox compile time or if you want to use the sandbox for multiple applications.

 ```c
 #include "application.h"

 int main() {
    setup_sandbox();
    application_run();
 }
 ```

 3. Have a binary for the application and a shared library which overwrites the std library's entry point function and sets up the sandbox before calling the main function. Then the application can be run like this: `LD_PRELOAD=./sandbox.so ./my_app arg1 arg2`. (`LD_PRELOAD` is used to override symbols in the stock libraries by creating a library with the same symbols). This can be a ok approach but relies on overriding stdlibs main which can be a bit finnicky.

Since this is just a educational project, I am not worried about modularity or scalability of the sandbox to other apps, so I decided to go with approach#2 solely for ease of development.

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

It is not fullproof and possible to escape this chroot jail using tricks mentioned in the [manual](https://man7.org/linux/man-pages/man2/chroot.2.html).

## namespaces

Linux namespaces are a mechanism provided by the kernel to make it appear to the processes that they have their own isolated instance of a particular global resource. There are 7 different type of namespaces, each isolating a different type of global resource:

 - UTS namespace - isolate hostname and NIS domain name
 - Mount namespace - isolate mounts
 - IPC namespace - isolate Message Queues (MQ), shared memory, semaphores
 - Network namespace - isolate network interfaces, ip adresses, routing tables, netfilter (firewall rules), socket-port number space, unix domain sockets
 - PID namespace - isolate process ids
 - Cgroup namespace - virtualize pathnames exposed in certain /proc/<PID> files that show cgroup membership of a process
 - User namespace - virtualize user and group ids (uid and gid)

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

After that is done, we can manipulate the mounts in the namespace.
```c
// error handling removed for sake of compactness
void setup_mounts(void) {
    //make your mount points private so that outside world cant see them
    int ret = mount(NULL, "/", NULL, MS_PRIVATE | MS_REC , NULL);

    // /tmp/sandbox_tmp outside will be root i.e. / inside sandbox
    char tmp_dir[] = "/tmp/sandbox_tmp";
    create_dir_if_not_exists(tmp_dir);
    // whatever was in /tmp/sandbox_tmp/ from before is still there
    // but have mounted a new tmpfs on top of it
    // so whatever was in there from before will
    // not be visible to sandbox anylonger
    ret = mount("tmpfs", tmp_dir, "tmpfs", 0, NULL);

    // if want to share a dir from outside into sandbox
    // /tmp/sandbox_tmp will become root / later so in order to make
    // the play dir accessible inside the sandbox as /my_play_dir
    // we create it in /tmp/sandbox_tmp/
    char common_dir[] = "/tmp/sandbox_tmp/my_play_dir";
    create_dir_if_not_exists(common_dir);
    ret = mount(PLAY_DIR_OUTSIDE_SANDBOX, common_dir, NULL, MS_BIND | MS_REC, NULL);

    // code for chrooting into /tmp/sandbox_tmp (see above) 
}
```

### Manipulating environment variables

It is worth mentioning that nix is a build tool but with nix-shell, just by manipulating the environment variables like the PATH, LD_LIBRARY_PATH etc, it provides meaningful, albeit leaky, isolation at runtime. It is a useful means of isolation because it is very simple. Although it should obviously be used only if you trust the application to respect the environment variables and not escape the filmsy sandbox. But the effectiveness of `nix-shell` tells me that it can work.
