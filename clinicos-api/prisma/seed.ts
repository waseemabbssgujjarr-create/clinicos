import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { addDays, subDays, addHours } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ClinicOS database...');

  // ── Super Admin ────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('DmaAdmin2026!', 12);
  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: process.env.SUPERADMIN_EMAIL ?? 'admin@doctorsmyagency.com' },
    update: { passwordHash: adminHash },
    create: {
      email: process.env.SUPERADMIN_EMAIL ?? 'admin@doctorsmyagency.com',
      passwordHash: adminHash,
      name: 'DMA Platform Admin',
    },
  });
  console.log('✅ Super admin:', superAdmin.email);

  // ── Plans ──────────────────────────────────────────────────────────────────
  const ts = Date.now();
  await prisma.plan.createMany({
    data: [
      { name: 'Starter',    stripePriceId: `starter_${ts}`,    priceMonthly: 29, maxStaff: 1,  maxPatients: 500,  aiMessagesLimit: 1000, features: '["dashboard","whatsapp_ai"]' },
      { name: 'Pro',        stripePriceId: `pro_${ts}`,        priceMonthly: 59, maxStaff: 3,  maxPatients: 2000, aiMessagesLimit: 5000, features: '["dashboard","whatsapp_ai","analytics"]' },
      { name: 'Enterprise', stripePriceId: `enterprise_${ts}`, priceMonthly: 99, maxStaff: 10, maxPatients: -1,   aiMessagesLimit: -1,   features: '["dashboard","whatsapp_ai","analytics","priority_support"]' },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Plans created');

  // ── Test Clinics ───────────────────────────────────────────────────────────
  const clinicData = [
    { name: 'DMA Demo Clinic', ownerName: 'Dr. Demo Doctor', email: 'support@clinicos.aderalabs.com', phone: '+971501112233', specialty: 'general', bookingSlug: 'dma-demo-clinic', address: 'Dubai, UAE' },
  ];

  const clinicHash = await bcrypt.hash('DmaTest2026!', 12);
  const workingHours = JSON.stringify({
    monday:    { isOpen: true,  open: '09:00', close: '17:00', slotDuration: 30 },
    tuesday:   { isOpen: true,  open: '09:00', close: '17:00', slotDuration: 30 },
    wednesday: { isOpen: true,  open: '09:00', close: '17:00', slotDuration: 30 },
    thursday:  { isOpen: true,  open: '09:00', close: '17:00', slotDuration: 30 },
    friday:    { isOpen: false },
    saturday:  { isOpen: true,  open: '10:00', close: '14:00', slotDuration: 30 },
    sunday:    { isOpen: false },
  });

  const treatments = JSON.stringify([
    { name: 'General Consultation', fee: 150 },
    { name: 'Teeth Whitening',      fee: 500 },
    { name: 'Root Canal',           fee: 800 },
    { name: 'Checkup & Cleaning',   fee: 200 },
    { name: 'X-Ray',                fee: 100 },
  ]);

  const clinics = [];
  for (const c of clinicData) {
    const clinic = await prisma.clinic.upsert({
      where: { email: c.email },
      update: {},
      create: { ...c, passwordHash: clinicHash, workingHours, treatments, plan: 'STARTER', planStatus: 'ACTIVE', onboardingDone: true, aiEnabled: true, autoConfirm: true },
    });
    clinics.push(clinic);
    console.log(`✅ Clinic: ${clinic.name}`);
  }

  // ── Test Staff ─────────────────────────────────────────────────────────────
  const staffHash = await bcrypt.hash('DmaStaff2026!', 12);
  await prisma.staffMember.upsert({
    where: { email: 'demo.staff@doctorsmyagency.com' },
    update: { passwordHash: staffHash, isActive: true },
    create: { clinicId: clinics[0].id, name: 'Demo Receptionist', email: 'demo.staff@doctorsmyagency.com', passwordHash: staffHash, role: 'RECEPTIONIST', isActive: true },
  });
  console.log('✅ Test staff created');

  // ── Patients, Appointments, Messages ──────────────────────────────────────
  const patientNames = ['Omar Khalid', 'Sara Ahmed', 'Mohammed Hassan', 'Aisha Al-Farsi', 'Yusuf Malik', 'Layla Ibrahim'];
  const statuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
  const channels = ['WHATSAPP', 'MANUAL', 'ONLINE_BOOKING'] as const;

  for (const clinic of clinics) {
    const patients = [];
    for (let i = 0; i < patientNames.length; i++) {
      const p = await prisma.patient.upsert({
        where: { clinicId_phone: { clinicId: clinic.id, phone: `+9715${i}${clinic.id.slice(0, 6)}` } },
        update: {},
        create: {
          clinicId: clinic.id, fullName: patientNames[i],
          phone: `+9715${i}${clinic.id.slice(0, 6)}`,
          email: `${patientNames[i].toLowerCase().replace(' ', '.')}@example.com`,
          gender: i % 2 === 0 ? 'male' : 'female',
        },
      });
      patients.push(p);
    }

    for (let i = 0; i < 15; i++) {
      const patient = patients[i % patients.length];
      const apptDate = addHours(addDays(new Date(), i < 7 ? i - 3 : i - 7), 9 + (i % 7));
      await prisma.appointment.create({
        data: {
          clinicId: clinic.id, patientId: patient.id,
          treatment: ['Teeth Whitening','Root Canal','Checkup & Cleaning','General Consultation','X-Ray'][i % 5],
          dateTime: apptDate, durationMin: 30,
          fee: [500,800,200,150,100][i % 5],
          status: statuses[i % statuses.length],
          channel: channels[i % channels.length],
          bookedByAI: i % 3 === 0, confirmationSent: true,
        },
      });
    }

    const msgBodies = ['I would like to book an appointment','What are your working hours?','Can I reschedule my appointment?','How much does a checkup cost?','I need to cancel my appointment'];
    for (let i = 0; i < 25; i++) {
      const patient = patients[i % patients.length];
      await prisma.message.create({
        data: {
          clinicId: clinic.id, patientId: patient.id,
          channel: i % 3 === 0 ? 'SMS' : 'WHATSAPP',
          direction: i % 2 === 0 ? 'INBOUND' : 'OUTBOUND',
          fromNumber: i % 2 === 0 ? patient.phone : clinic.phone,
          toNumber:   i % 2 === 0 ? clinic.phone  : patient.phone,
          body: msgBodies[i % msgBodies.length],
          isRead: i % 4 !== 0, isHandledByAI: i % 3 === 0,
          aiConfidence: i % 3 === 0 ? 0.92 : null,
          createdAt: subDays(new Date(), Math.floor(i / 5)),
        },
      });
    }

    for (let i = 0; i < 15; i++) {
      await prisma.aILog.create({
        data: {
          clinicId: clinic.id,
          action: ['booked_appointment','sent_reminder','answered_faq','sent_review_request'][i % 4],
          details: 'AI handled patient inquiry successfully',
          patientId: patients[i % patients.length].id,
          success: true, durationMs: 800 + i * 50,
          createdAt: subDays(new Date(), Math.floor(i / 3)),
        },
      });
    }

    for (const n of [
      { title: 'New Message',           body: 'Omar Khalid sent a WhatsApp message',       type: 'message' },
      { title: 'Appointment Cancelled', body: 'Sara Ahmed cancelled her appointment',       type: 'cancellation' },
      { title: 'New Patient',           body: 'Mohammed Hassan registered as a new patient',type: 'new_patient' },
    ]) {
      await prisma.notification.create({ data: { clinicId: clinic.id, ...n, color: 'teal' } });
    }
    console.log(`✅ Data seeded for: ${clinic.name}`);
  }

  console.log('\n🎉 ClinicOS database seeded!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST LOGINS:');
  console.log('Doctor:     support@clinicos.aderalabs.com / DmaTest2026!');
  console.log('Staff:      demo.staff@doctorsmyagency.com  / DmaStaff2026!');
  console.log('SuperAdmin: admin@doctorsmyagency.com / DmaAdmin2026!');
  console.log('Booking:    /book/dma-demo-clinic');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
