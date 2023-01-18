
Imagine you want to create your own browser application. Or any other application where you will execute code from unknown or untrusted sources. How can you run that code safely, without giving it access to personal data on the filesystem, and without borking  other apps and data? Let us explore this question. 

## Plain old linux processes and users 

Are linux processes not isolated from each other? In some ways, yes, a process provides some isolation, such as -
 - A process's virtual address space is fully isolated from another, so memory is isolated (unless explicitly using shared memory)
 - Processes have separate open file descriptors, independent current working directories etc. Processes cannot mess with each others state in general.

However, the filesystem is shared. Process can open, read and modify directories, files, named pipes, message queues etc. (those which the processes effective user has permission to access).

The ptrace() system call provides a means by which one process (the "tracer") may observe and control the execution of another process (the "tracee").

A process can easily get information about other processes by looking at /proc/ and further inspect and control them using ptrace system call (this system call is also used for implementing debuggers like gdb). Therefore, it is not far fetched that a rogue process can potentially mess with other processes if permissions are right, for e.g. changing the memory addresses and register.

Also, the hardware resources such as CPU, RAM, network interfaces etc. are shared. So it is possible for one process to hoard compute resources.

A sufficiently priviliged process can change the system hostname, ip tables, network interfaces, firewall rules, occupy sockets/ports and so on.

## Why run untrusted code in priviliged mode?

A common thread in the above is that a process needs to have sufficient priviliges in order to do evil things. For e.g. a process running as root will be able to do a lot of bad things to other.

Now the question, you might ask is: why not just run the process as a user with very little or no permissions (limited capabilities and limited filesystem access). Well, that is possible, but sometimes a process legitimately needs elevated access to perform its work. The traditional way this was done (and is still done quite widely) is to run the processes as root.

## Aside: setuid/setgid

Normally, a process gets the same access as the user who runs it. However, that is not always enough. Instead of giving a lot of privilieges to all users, there is an alternative. Binary executable files can be given special permission via setuid and setgid bit. So whenever they are executed, they get additional root priviliges that the user who ran them might not have.

## Capabilities

Running processes as root (using setgid/setuid bit or running as root user) are all or nothing. That is not great. What if you wanted to give a process ability to do only one priviliged thing, which is be able to set process scheduling priority. In order to address this, linux divided the root powers into smaller units, called capabilities.

There are around 40 capabilities in total - e.g. CAP_SYS_TIME capability is needed to change system time.
Unfortunately there is still a big CAP_SYS_ADMIN capability which grants a large portion of power.

-------
## Sandboxing

We want to limit the power and access of the application and isolate it from other applications and data on the system. This concept is called sandboxing.

Even if you trust the code, providing isolation like this is super useful in order to be able to isolate problems. You can avoid problems where one application needs a certain version of libA while another application needs a different version of libA. By isolating the filesystem access, different containers can install different versions of the same library without affecting each other.

Docker containers are a prime example of this.

In order to implement this.
I will talk about these in varying level of detail:

- linux namespaces
- cgroups
- seccommp
- capabilities(7)
- LD_PRELOAD trick
- chroot