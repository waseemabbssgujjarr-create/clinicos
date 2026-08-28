
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.14.0
 * Query Engine version: e9771e62de70f79a5e1c604a2d7c8e2a0a874b48
 */
Prisma.prismaVersion = {
  client: "5.14.0",
  engine: "e9771e62de70f79a5e1c604a2d7c8e2a0a874b48"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}

/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.SuperAdminScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  name: 'name',
  createdAt: 'createdAt'
};

exports.Prisma.ClinicScalarFieldEnum = {
  id: 'id',
  name: 'name',
  ownerName: 'ownerName',
  phone: 'phone',
  email: 'email',
  passwordHash: 'passwordHash',
  specialty: 'specialty',
  address: 'address',
  logoUrl: 'logoUrl',
  bookingSlug: 'bookingSlug',
  timezone: 'timezone',
  workingHours: 'workingHours',
  treatments: 'treatments',
  defaultFee: 'defaultFee',
  aiEnabled: 'aiEnabled',
  aiLanguage: 'aiLanguage',
  aiPersonality: 'aiPersonality',
  autoConfirm: 'autoConfirm',
  reminderTiming: 'reminderTiming',
  reviewTiming: 'reviewTiming',
  customIntroMsg: 'customIntroMsg',
  googlePlaceId: 'googlePlaceId',
  googleApiKey: 'googleApiKey',
  stripeCustomerId: 'stripeCustomerId',
  stripeSubId: 'stripeSubId',
  plan: 'plan',
  planStatus: 'planStatus',
  trialEndsAt: 'trialEndsAt',
  currentPeriodEnd: 'currentPeriodEnd',
  emailVerified: 'emailVerified',
  emailVerifyToken: 'emailVerifyToken',
  emailVerifyExpires: 'emailVerifyExpires',
  isActive: 'isActive',
  onboardingDone: 'onboardingDone',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StaffMemberScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  name: 'name',
  email: 'email',
  phone: 'phone',
  passwordHash: 'passwordHash',
  role: 'role',
  isActive: 'isActive',
  emailVerified: 'emailVerified',
  emailVerifyToken: 'emailVerifyToken',
  emailVerifyExpires: 'emailVerifyExpires',
  inviteToken: 'inviteToken',
  inviteExpiry: 'inviteExpiry',
  lastLogin: 'lastLogin',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PatientScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  fullName: 'fullName',
  phone: 'phone',
  email: 'email',
  dateOfBirth: 'dateOfBirth',
  gender: 'gender',
  bloodGroup: 'bloodGroup',
  medicalNotes: 'medicalNotes',
  allergies: 'allergies',
  emergencyName: 'emergencyName',
  emergencyPhone: 'emergencyPhone',
  isActive: 'isActive',
  magicLinkToken: 'magicLinkToken',
  magicLinkExpiry: 'magicLinkExpiry',
  portalEnabled: 'portalEnabled',
  optedOut: 'optedOut',
  optedOutAt: 'optedOutAt',
  leadScore: 'leadScore',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AppointmentScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  patientId: 'patientId',
  treatment: 'treatment',
  dateTime: 'dateTime',
  durationMin: 'durationMin',
  status: 'status',
  channel: 'channel',
  notes: 'notes',
  fee: 'fee',
  confirmationSent: 'confirmationSent',
  reminder24hSent: 'reminder24hSent',
  reminder2hSent: 'reminder2hSent',
  reviewSent: 'reviewSent',
  bookedByStaffId: 'bookedByStaffId',
  bookedByAI: 'bookedByAI',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MessageScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  patientId: 'patientId',
  channel: 'channel',
  direction: 'direction',
  fromNumber: 'fromNumber',
  toNumber: 'toNumber',
  body: 'body',
  isRead: 'isRead',
  isHandledByAI: 'isHandledByAI',
  aiConfidence: 'aiConfidence',
  needsReview: 'needsReview',
  tags: 'tags',
  intent: 'intent',
  summary: 'summary',
  twilioSid: 'twilioSid',
  replyToId: 'replyToId',
  createdAt: 'createdAt'
};

exports.Prisma.AILogScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  action: 'action',
  details: 'details',
  patientId: 'patientId',
  success: 'success',
  error: 'error',
  durationMs: 'durationMs',
  createdAt: 'createdAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  title: 'title',
  body: 'body',
  type: 'type',
  color: 'color',
  isRead: 'isRead',
  link: 'link',
  createdAt: 'createdAt'
};

exports.Prisma.BroadcastScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  channel: 'channel',
  targetGroup: 'targetGroup',
  messageBody: 'messageBody',
  sentCount: 'sentCount',
  failedCount: 'failedCount',
  status: 'status',
  createdAt: 'createdAt'
};

exports.Prisma.InvoiceScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  stripeInvoiceId: 'stripeInvoiceId',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  period: 'period',
  pdfUrl: 'pdfUrl',
  paidAt: 'paidAt',
  createdAt: 'createdAt'
};

exports.Prisma.PlanScalarFieldEnum = {
  id: 'id',
  name: 'name',
  stripePriceId: 'stripePriceId',
  priceMonthly: 'priceMonthly',
  maxStaff: 'maxStaff',
  maxPatients: 'maxPatients',
  aiMessagesLimit: 'aiMessagesLimit',
  features: 'features',
  isActive: 'isActive',
  createdAt: 'createdAt'
};

exports.Prisma.LeadScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  patientId: 'patientId',
  fullName: 'fullName',
  phone: 'phone',
  email: 'email',
  enquiryReason: 'enquiryReason',
  treatmentInterest: 'treatmentInterest',
  intent: 'intent',
  status: 'status',
  leadScore: 'leadScore',
  source: 'source',
  tags: 'tags',
  followUpCount: 'followUpCount',
  lastFollowUpAt: 'lastFollowUpAt',
  nextFollowUpAt: 'nextFollowUpAt',
  rescuedAt: 'rescuedAt',
  convertedAt: 'convertedAt',
  estimatedValue: 'estimatedValue',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MissedCallScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  callerPhone: 'callerPhone',
  calledAt: 'calledAt',
  recoverySent: 'recoverySent',
  recoverySentAt: 'recoverySentAt',
  replied: 'replied',
  repliedAt: 'repliedAt',
  booked: 'booked',
  bookedAt: 'bookedAt',
  appointmentId: 'appointmentId',
  recoveredValue: 'recoveredValue',
  leadId: 'leadId'
};

exports.Prisma.DailyBriefScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  briefDate: 'briefDate',
  appointmentsToday: 'appointmentsToday',
  appointmentsBooked: 'appointmentsBooked',
  chatsHandled: 'chatsHandled',
  newLeads: 'newLeads',
  hotLeads: 'hotLeads',
  missedCalls: 'missedCalls',
  recoveredBookings: 'recoveredBookings',
  recoveredRevenue: 'recoveredRevenue',
  lostLeadsRescued: 'lostLeadsRescued',
  noShows: 'noShows',
  summary: 'summary',
  actionItems: 'actionItems',
  sentAt: 'sentAt',
  createdAt: 'createdAt'
};

exports.Prisma.PasswordResetScalarFieldEnum = {
  id: 'id',
  email: 'email',
  token: 'token',
  expiresAt: 'expiresAt',
  used: 'used',
  createdAt: 'createdAt'
};

exports.Prisma.PlatformSettingScalarFieldEnum = {
  key: 'key',
  value: 'value',
  updatedAt: 'updatedAt',
  updatedBy: 'updatedBy'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.ClinicPlan = exports.$Enums.ClinicPlan = {
  TRIAL: 'TRIAL',
  STARTER: 'STARTER',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE'
};

exports.PlanStatus = exports.$Enums.PlanStatus = {
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELLED: 'CANCELLED',
  TRIALING: 'TRIALING'
};

exports.StaffRole = exports.$Enums.StaffRole = {
  RECEPTIONIST: 'RECEPTIONIST',
  NURSE: 'NURSE',
  ASSISTANT: 'ASSISTANT',
  MANAGER: 'MANAGER'
};

exports.LeadScore = exports.$Enums.LeadScore = {
  HOT: 'HOT',
  WARM: 'WARM',
  COLD: 'COLD'
};

exports.AppointmentStatus = exports.$Enums.AppointmentStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  ARRIVED: 'ARRIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
  RESCHEDULED: 'RESCHEDULED'
};

exports.BookingChannel = exports.$Enums.BookingChannel = {
  MANUAL: 'MANUAL',
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
  CALL: 'CALL',
  EMAIL: 'EMAIL',
  ONLINE_BOOKING: 'ONLINE_BOOKING',
  STAFF_PORTAL: 'STAFF_PORTAL'
};

exports.MessageChannel = exports.$Enums.MessageChannel = {
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
  CALL: 'CALL',
  EMAIL: 'EMAIL',
  INSTAGRAM: 'INSTAGRAM',
  WEBSITE: 'WEBSITE'
};

exports.Direction = exports.$Enums.Direction = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND'
};

exports.LeadIntent = exports.$Enums.LeadIntent = {
  BOOKING: 'BOOKING',
  PRICE: 'PRICE',
  TREATMENT: 'TREATMENT',
  EMERGENCY: 'EMERGENCY',
  GENERAL: 'GENERAL'
};

exports.LeadStatus = exports.$Enums.LeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  BOOKED: 'BOOKED',
  VISITED: 'VISITED',
  FOLLOW_UP: 'FOLLOW_UP',
  CONVERTED: 'CONVERTED',
  LOST: 'LOST'
};

exports.Prisma.ModelName = {
  SuperAdmin: 'SuperAdmin',
  Clinic: 'Clinic',
  StaffMember: 'StaffMember',
  Patient: 'Patient',
  Appointment: 'Appointment',
  Message: 'Message',
  AILog: 'AILog',
  Notification: 'Notification',
  Broadcast: 'Broadcast',
  Invoice: 'Invoice',
  Plan: 'Plan',
  Lead: 'Lead',
  MissedCall: 'MissedCall',
  DailyBrief: 'DailyBrief',
  PasswordReset: 'PasswordReset',
  PlatformSetting: 'PlatformSetting'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
