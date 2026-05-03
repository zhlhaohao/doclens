# Linux System Administration: Essential Guide

## System Management with systemd

systemd is the init system and service manager used by virtually all modern Linux distributions. Understanding systemd is essential for effective system administration.

### Service Management

```bash
# Start, stop, restart a service
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx

# Reload configuration without restarting
sudo systemctl reload nginx

# Enable/disable service at boot
sudo systemctl enable nginx
sudo systemctl disable nginx

# Check service status
sudo systemctl status nginx

# List all active services
systemctl list-units --type=service --state=active

# List failed services
systemctl --failed
```

### Creating Custom Service Units

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Application Service
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=myapp
Group=myapp
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/bin/myapp --config /etc/myapp/config.yaml
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5
TimeoutStartSec=300
TimeoutStopSec=30

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/myapp /var/lib/myapp
PrivateTmp=true

# Resource limits
LimitNOFILE=65536
MemoryMax=2G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
```

```bash
# Apply changes
sudo systemctl daemon-reload
sudo systemctl enable myapp
sudo systemctl start myapp
```

### Timer Units (Cron Replacement)

```ini
# /etc/systemd/system/backup.timer
[Unit]
Description=Daily Backup Timer

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

```ini
# /etc/systemd/system/backup.service
[Unit]
Description=Run Backup

[Service]
Type=oneshot
ExecStart=/opt/backup/backup.sh
```

## Logging with journalctl

journald collects and stores log data from the kernel, systemd services, and other system components.

### Essential Commands

```bash
# View all logs (newest first)
journalctl -r

# Follow logs in real-time
journalctl -f

# Filter by service
journalctl -u nginx
journalctl -u nginx --since "1 hour ago"

# Filter by time range
journalctl --since "2025-05-01" --until "2025-05-03"
journalctl --since "today"
journalctl --since "yesterday"

# Filter by priority
journalctl -p err          # Errors only
journalctl -p warning      # Warnings and above
# Priority levels: emerg(0), alert(1), crit(2), err(3),
#                  warning(4), notice(5), info(6), debug(7)

# Filter by process
journalctl _PID=1234

# Kernel messages only
journalctl -k

# Show boot logs
journalctl -b              # Current boot
journalctl -b -1           # Previous boot

# Disk usage
journalctl --disk-usage

# Clean old logs (keep last 7 days)
sudo journalctl --vacuum-time=7d

# Output formatting
journalctl -o json-pretty  # JSON format
journalctl -o cat          # Message only, no metadata
```

### Persistent Logging
By default, journals are stored in `/run/log/journal/` and lost on reboot. To persist:

```bash
sudo mkdir -p /var/log/journal
sudo systemd-tmpfiles --create --prefix /var/log/journal
sudo systemctl restart systemd-journald
```

## Network Configuration

### NetworkManager (nmcli)

```bash
# List connections
nmcli connection show

# List devices and status
nmcli device status

# Configure static IP
nmcli connection modify eth0 \
    ipv4.addresses 192.168.1.100/24 \
    ipv4.gateway 192.168.1.1 \
    ipv4.dns "8.8.8.8 8.8.4.4" \
    ipv4.method manual

# Apply changes
nmcli connection up eth0

# Add a new connection
nmcli connection add type ethernet \
    con-name "static-eth0" \
    ifname eth0 \
    ip4 192.168.1.100/24 \
    gw4 192.168.1.1

# WiFi management
nmcli device wifi list
nmcli device wifi connect "SSID" password "password"
```

### systemd-networkd

```ini
# /etc/systemd/network/10-eth0.network
[Match]
Name=eth0

[Network]
Address=192.168.1.100/24
Gateway=192.168.1.1
DNS=8.8.8.8
DNS=8.8.4.4

[Route]
Destination=10.0.0.0/8
Gateway=192.168.1.254
```

### Firewall Management

```bash
# firewalld (RHEL/CentOS/Fedora)
sudo firewall-cmd --state
sudo firewall-cmd --list-all
sudo firewall-cmd --add-port=8080/tcp --permanent
sudo firewall-cmd --add-service=http --permanent
sudo firewall-cmd --reload

# ufw (Ubuntu/Debian)
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow from 192.168.1.0/24 to any port 5432
sudo ufw enable
```

## Disk and File System Management

### Essential Commands

```bash
# Disk usage overview
df -h

# Directory size
du -sh /var/log
du -h --max-depth=1 /var

# Find large files
find / -type f -size +100M -exec ls -lh {} \;

# Inode usage
df -i

# Mount points
findmnt
mount | column -t

# LVM management
pvdisplay              # Physical volumes
vgdisplay              # Volume groups
lvdisplay              # Logical volumes
lvextend -L +10G /dev/vg0/data   # Extend LV
resize2fs /dev/vg0/data          # Resize filesystem
```

### SMART Disk Monitoring

```bash
# Install smartmontools
sudo apt install smartmontools    # Debian/Ubuntu
sudo dnf install smartmontools    # RHEL/Fedora

# Check disk health
sudo smartctl -a /dev/sda

# Run short self-test
sudo smartctl -t short /dev/sda

# Enable automatic monitoring
sudo systemctl enable smartd
sudo systemctl start smartd
```

## Performance Monitoring

```bash
# Real-time system monitoring
htop
atop

# CPU and process stats
mpstat 1 10            # CPU stats every 1 second, 10 times
pidstat -u 1           # Per-process CPU usage

# Memory analysis
free -h
vmstat 1 10
slabtop                # Kernel slab cache usage

# I/O monitoring
iostat -xz 1           # Extended disk I/O stats
iotop                   # Per-process I/O usage

# Network monitoring
ss -tulnp              # Listening ports and processes
nethogs                 # Per-process network usage
iftop                   # Real-time bandwidth usage

# System load analysis
uptime
sar -u 1 10            # Historical CPU data (sysstat package)
```

## Security Hardening Checklist

1. **SSH hardening**: Disable password auth, use key-based authentication only
2. **Fail2ban**: Auto-ban IPs with repeated failed login attempts
3. **Automatic updates**: Configure unattended-upgrades for security patches
4. **Audit logging**: Install and configure auditd for system call auditing
5. **File integrity**: Deploy AIDE or Tripwire for file change detection
6. **Principle of least privilege**: Use sudo instead of root, configure NOPASSWD sparingly
7. **Kernel parameters**: Configure sysctl settings for network security (syn cookies, IP forwarding)
