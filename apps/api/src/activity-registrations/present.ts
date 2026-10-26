import {
  REGISTRATION_PROFESSION_LABEL,
  REGISTRATION_STATUS_LABEL,
  type RegistrationProfession,
} from '@ocr/shared-types';
import type { RegistrationAttendanceStatus } from '@ocr/shared-types';
import type { Prisma } from '@prisma/client';

type RegistrationRow = Prisma.ActivityRegistrationGetPayload<{
  include: { club: { select: { name: true } } };
}>;

export function presentRegistration(row: RegistrationRow) {
  const profession = row.profession as RegistrationProfession;
  const attendanceStatus = row.attendanceStatus as RegistrationAttendanceStatus;
  return {
    id: row.id,
    activityId: row.activityId,
    clubId: row.clubId,
    clubName: row.club.name,
    playerName: row.playerName,
    score: row.score,
    profession: row.profession,
    professionLabel: REGISTRATION_PROFESSION_LABEL[profession],
    attendanceStatus: row.attendanceStatus,
    statusLabel: REGISTRATION_STATUS_LABEL[attendanceStatus],
    submitIp: row.submitIp,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
