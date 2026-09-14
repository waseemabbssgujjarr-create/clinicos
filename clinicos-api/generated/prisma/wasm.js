
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
  practitionerId: 'practitionerId',
  locationId: 'locationId',
  roomId: 'roomId',
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
  calledAt: 'calledAt',
  calledBy: 'calledBy',
  chartMigratedAt: 'chartMigratedAt',
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
  metaMessageId: 'metaMessageId',
  replyToId: 'replyToId',
  deliveryStatus: 'deliveryStatus',
  senderType: 'senderType',
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

exports.Prisma.ClinicWhatsAppConnectionScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  connectionMethod: 'connectionMethod',
  businessPortfolioId: 'businessPortfolioId',
  wabaId: 'wabaId',
  phoneNumberId: 'phoneNumberId',
  phoneNumber: 'phoneNumber',
  displayName: 'displayName',
  accessTokenEnc: 'accessTokenEnc',
  connectionStatus: 'connectionStatus',
  webhookStatus: 'webhookStatus',
  tokenMetadata: 'tokenMetadata',
  lastVerifiedAt: 'lastVerifiedAt',
  lastError: 'lastError',
  connectedAt: 'connectedAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlatformSettingScalarFieldEnum = {
  key: 'key',
  value: 'value',
  updatedAt: 'updatedAt',
  updatedBy: 'updatedBy'
};

exports.Prisma.AITrainingRuleScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  question: 'question',
  answer: 'answer',
  category: 'category',
  isActive: 'isActive',
  priority: 'priority',
  matchType: 'matchType',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AITrainingProfileScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  draftJson: 'draftJson',
  publishedJson: 'publishedJson',
  draftUpdatedAt: 'draftUpdatedAt',
  publishedAt: 'publishedAt',
  publishedBy: 'publishedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ConversationStateScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  patientId: 'patientId',
  turnCount: 'turnCount',
  greetingSent: 'greetingSent',
  lastIntent: 'lastIntent',
  lastAction: 'lastAction',
  pendingQuestion: 'pendingQuestion',
  pendingSlot: 'pendingSlot',
  lastOutboundBody: 'lastOutboundBody',
  lastFallbackHash: 'lastFallbackHash',
  memoryJson: 'memoryJson',
  updatedAt: 'updatedAt',
  createdAt: 'createdAt'
};

exports.Prisma.PractitionerScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  name: 'name',
  specialty: 'specialty',
  isPrimary: 'isPrimary',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LocationScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  name: 'name',
  address: 'address',
  isPrimary: 'isPrimary',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RoomScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  locationId: 'locationId',
  name: 'name',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LeaveScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  practitionerId: 'practitionerId',
  startsAt: 'startsAt',
  endsAt: 'endsAt',
  reason: 'reason',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ScheduleBlockScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  practitionerId: 'practitionerId',
  locationId: 'locationId',
  roomId: 'roomId',
  startsAt: 'startsAt',
  endsAt: 'endsAt',
  kind: 'kind',
  reason: 'reason',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EncounterScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  appointmentId: 'appointmentId',
  patientId: 'patientId',
  practitionerId: 'practitionerId',
  status: 'status',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  migratedFromNotesAt: 'migratedFromNotesAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClinicalNoteScalarFieldEnum = {
  id: 'id',
  encounterId: 'encounterId',
  complaint: 'complaint',
  history: 'history',
  exam: 'exam',
  assessment: 'assessment',
  treatment: 'treatment',
  freeText: 'freeText',
  draft: 'draft',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ObservationScalarFieldEnum = {
  id: 'id',
  encounterId: 'encounterId',
  code: 'code',
  display: 'display',
  value: 'value',
  unit: 'unit',
  recordedAt: 'recordedAt'
};

exports.Prisma.DiagnosisScalarFieldEnum = {
  id: 'id',
  encounterId: 'encounterId',
  condition: 'condition',
  code: 'code',
  display: 'display',
  isPrimary: 'isPrimary',
  recordedAt: 'recordedAt'
};

exports.Prisma.PrescriptionScalarFieldEnum = {
  id: 'id',
  encounterId: 'encounterId',
  clinicId: 'clinicId',
  status: 'status',
  issuedAt: 'issuedAt',
  issuedBy: 'issuedBy',
  cancelledAt: 'cancelledAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PrescriptionItemScalarFieldEnum = {
  id: 'id',
  prescriptionId: 'prescriptionId',
  drug: 'drug',
  strength: 'strength',
  route: 'route',
  dose: 'dose',
  frequency: 'frequency',
  duration: 'duration',
  quantity: 'quantity',
  instructions: 'instructions',
  refills: 'refills',
  sortOrder: 'sortOrder'
};

exports.Prisma.FollowUpScalarFieldEnum = {
  id: 'id',
  encounterId: 'encounterId',
  note: 'note',
  dueDate: 'dueDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PatientInvoiceScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  patientId: 'patientId',
  appointmentId: 'appointmentId',
  amount: 'amount',
  balance: 'balance',
  currency: 'currency',
  status: 'status',
  note: 'note',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PatientPaymentScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  patientId: 'patientId',
  invoiceId: 'invoiceId',
  amount: 'amount',
  method: 'method',
  kind: 'kind',
  recordedAt: 'recordedAt',
  note: 'note'
};

exports.Prisma.PatientLedgerEntryScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  patientId: 'patientId',
  invoiceId: 'invoiceId',
  type: 'type',
  amount: 'amount',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.PatientDocumentScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  patientId: 'patientId',
  type: 'type',
  filename: 'filename',
  mimeType: 'mimeType',
  size: 'size',
  storageKey: 'storageKey',
  uploadedBy: 'uploadedBy',
  createdAt: 'createdAt'
};

exports.Prisma.LabOrderScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  patientId: 'patientId',
  appointmentId: 'appointmentId',
  encounterId: 'encounterId',
  status: 'status',
  note: 'note',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LabOrderItemScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  testName: 'testName',
  code: 'code',
  status: 'status'
};

exports.Prisma.LabResultScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  itemId: 'itemId',
  code: 'code',
  value: 'value',
  unit: 'unit',
  flag: 'flag',
  reportedAt: 'reportedAt'
};

exports.Prisma.SkuScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  name: 'name',
  unit: 'unit',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StockLotScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  skuId: 'skuId',
  lotCode: 'lotCode',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.StockMovementScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  skuId: 'skuId',
  lotId: 'lotId',
  type: 'type',
  quantity: 'quantity',
  note: 'note',
  createdAt: 'createdAt',
  createdBy: 'createdBy'
};

exports.Prisma.DispenseScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  skuId: 'skuId',
  lotId: 'lotId',
  prescriptionId: 'prescriptionId',
  prescriptionItemId: 'prescriptionItemId',
  quantity: 'quantity',
  createdAt: 'createdAt',
  createdBy: 'createdBy'
};

exports.Prisma.TeleSessionScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  appointmentId: 'appointmentId',
  provider: 'provider',
  providerSessionId: 'providerSessionId',
  status: 'status',
  startedAt: 'startedAt',
  endedAt: 'endedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CoverageScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  patientId: 'patientId',
  payer: 'payer',
  memberId: 'memberId',
  isPrimary: 'isPrimary',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClaimScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  coverageId: 'coverageId',
  amount: 'amount',
  status: 'status',
  note: 'note',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  actorId: 'actorId',
  actorRole: 'actorRole',
  action: 'action',
  entityType: 'entityType',
  entityId: 'entityId',
  details: 'details',
  success: 'success',
  createdAt: 'createdAt'
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
  CALLED: 'CALLED',
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

exports.RoomStatus = exports.$Enums.RoomStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  OCCUPIED: 'OCCUPIED',
  BLOCKED: 'BLOCKED'
};

exports.EncounterStatus = exports.$Enums.EncounterStatus = {
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED'
};

exports.PrescriptionStatus = exports.$Enums.PrescriptionStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  CANCELLED: 'CANCELLED'
};

exports.PatientInvoiceStatus = exports.$Enums.PatientInvoiceStatus = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  VOID: 'VOID',
  REFUNDED: 'REFUNDED'
};

exports.LabOrderStatus = exports.$Enums.LabOrderStatus = {
  ORDERED: 'ORDERED',
  COLLECTED: 'COLLECTED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
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
  ClinicWhatsAppConnection: 'ClinicWhatsAppConnection',
  PlatformSetting: 'PlatformSetting',
  AITrainingRule: 'AITrainingRule',
  AITrainingProfile: 'AITrainingProfile',
  ConversationState: 'ConversationState',
  Practitioner: 'Practitioner',
  Location: 'Location',
  Room: 'Room',
  Leave: 'Leave',
  ScheduleBlock: 'ScheduleBlock',
  Encounter: 'Encounter',
  ClinicalNote: 'ClinicalNote',
  Observation: 'Observation',
  Diagnosis: 'Diagnosis',
  Prescription: 'Prescription',
  PrescriptionItem: 'PrescriptionItem',
  FollowUp: 'FollowUp',
  PatientInvoice: 'PatientInvoice',
  PatientPayment: 'PatientPayment',
  PatientLedgerEntry: 'PatientLedgerEntry',
  PatientDocument: 'PatientDocument',
  LabOrder: 'LabOrder',
  LabOrderItem: 'LabOrderItem',
  LabResult: 'LabResult',
  Sku: 'Sku',
  StockLot: 'StockLot',
  StockMovement: 'StockMovement',
  Dispense: 'Dispense',
  TeleSession: 'TeleSession',
  Coverage: 'Coverage',
  Claim: 'Claim',
  AuditLog: 'AuditLog'
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
