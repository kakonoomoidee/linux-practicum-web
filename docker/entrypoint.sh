#!/bin/bash
set -e

STUDENT_USER="${STUDENT_USER:-mahasiswa}"
STUDENT_PASS="${STUDENT_PASS:-changeme123}"

if ! id "$STUDENT_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$STUDENT_USER"
fi

echo "${STUDENT_USER}:${STUDENT_PASS}" | chpasswd
usermod -aG sudo "$STUDENT_USER"
echo "${STUDENT_USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-${STUDENT_USER}
chmod 0440 /etc/sudoers.d/90-${STUDENT_USER}
chown -R "${STUDENT_USER}:${STUDENT_USER}" "/home/${STUDENT_USER}"

ssh-keygen -A
exec /usr/sbin/sshd -D -e
