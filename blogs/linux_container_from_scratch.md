
Imagine you want to create your own browser application. Or any other application where you will execute code from unknown or untrusted sources. How can you run that code safely, without giving it access to personal data on the filesystem, and without borking  other apps and data? Let us explore this question. 

## Plain old linux processes and users 

Are linux processes not isolated from each other? In some ways, yes, a process provides some isolation, such as -
 - A process's virtual address space is fully isolated from another, so memory is isolated (unless explicitly using shared memory)
 - Processes have separate open file descriptors, independent current working directories etc. Processes cannot mess with each others state in general.

However, the filesystem is shared. Process can open, read and modify directories, files, named pipes, message queues etc. which the processes effective user has permission to access.

A process can easily get information about other processes by looking at /proc/ and further inspect and control them using ptrace system call (this system call is also used for implementing debuggers like gdb). Therefore, it is not far fetched that a rogue process can potentially mess with other processes if permissions are right, for e.g. changing their `nice` value i.e. scheduling priority.

Process can change the system hostname, ip tables, network interfaces, firewall rules, occupy sockets/ports and so on


The hardware resources such as CPU, RAM, network interfaces etc. are shared.

So it is possible for one.


One thing you might consider doing is running the process as 


-------

This concept is called sandboxing. We want to limit the power and access of the application and isolate it from other applications and data on the system.

Even if you trust the code, providing isolation like this is super useful in order to be able to isolate problems. You can avoid problems where one application needs a certain version of libA while another application needs a different version of libA. By isolating the filesystem access, different containers can install different versions of the same library without affecting each other.

Docker containers are a prime example of this.

I will talk about these in varying level of detail:

- linux namespaces
- cgroups
- seccommp
- capabilities(7)
- LD_PRELOAD trick
- chroot