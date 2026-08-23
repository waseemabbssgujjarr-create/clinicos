"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMiddleware = exports.uploadLogo = exports.updateTreatments = exports.updateWorkingHours = exports.updateAISettings = exports.updateClinicInfo = exports.getSettings = void 0;
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const settings_schemas_1 = require("../schemas/settings.schemas");
const cloudinary_1 = require("cloudinary");
const multer_1 = __importDefault(require("multer"));
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// GET /api/settings
exports.getSettings = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: {
            id: true, name: true, ownerName: true, email: true, phone: true,
            specialty: true, address: true, logoUrl: true, timezone: true,
            bookingSlug: true, workingHours: true, treatments: true, defaultFee: true,
            aiEnabled: true, aiLanguage: true, aiPersonality: true, autoConfirm: true,
            reminderTiming: true, reviewTiming: true, customIntroMsg: true,
            googlePlaceId: true, onboardingDone: true,
        },
    });
    if (!clinic)
        throw (0, error_middleware_1.createError)('Clinic not found', 404, 'NOT_FOUND');
    res.json(clinic);
});
// PATCH /api/settings/clinic
exports.updateClinicInfo = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = settings_schemas_1.UpdateClinicSchema.parse(req.body);
    const clinicId = req.clinicId;
    if (data.bookingSlug) {
        const existing = await prisma_1.prisma.clinic.findFirst({
            where: { bookingSlug: data.bookingSlug, NOT: { id: clinicId } },
        });
        if (existing)
            throw (0, error_middleware_1.createError)('This booking URL is already taken', 409, 'SLUG_TAKEN');
    }
    const clinic = await prisma_1.prisma.clinic.update({
        where: { id: clinicId },
        data,
    });
    res.json(clinic);
});
// PATCH /api/settings/ai
exports.updateAISettings = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = settings_schemas_1.UpdateAISettingsSchema.parse(req.body);
    const clinic = await prisma_1.prisma.clinic.update({
        where: { id: req.clinicId },
        data,
    });
    res.json(clinic);
});
// PATCH /api/settings/hours
exports.updateWorkingHours = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = settings_schemas_1.UpdateWorkingHoursSchema.parse(req.body);
    const clinic = await prisma_1.prisma.clinic.update({
        where: { id: req.clinicId },
        data: { workingHours: data.workingHours },
    });
    res.json(clinic);
});
// PATCH /api/settings/treatments
exports.updateTreatments = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = settings_schemas_1.UpdateTreatmentsSchema.parse(req.body);
    const clinic = await prisma_1.prisma.clinic.update({
        where: { id: req.clinicId },
        data: { treatments: data.treatments, onboardingDone: true },
    });
    res.json(clinic);
});
// POST /api/settings/logo
exports.uploadLogo = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.file)
        throw (0, error_middleware_1.createError)('No file uploaded', 400, 'NO_FILE');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(req.file.mimetype)) {
        throw (0, error_middleware_1.createError)('Only JPEG, PNG, WebP, or SVG files are allowed', 400, 'INVALID_FILE_TYPE');
    }
    if (req.file.size > 5 * 1024 * 1024) {
        throw (0, error_middleware_1.createError)('File size must be under 5MB', 400, 'FILE_TOO_LARGE');
    }
    const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder: 'medicore/logos',
            public_id: `clinic-${req.clinicId}`,
            overwrite: true,
            transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
        }, (err, result) => {
            if (err || !result)
                reject(err);
            else
                resolve(result);
        });
        uploadStream.end(req.file.buffer);
    });
    await prisma_1.prisma.clinic.update({
        where: { id: req.clinicId },
        data: { logoUrl: result.secure_url },
    });
    res.json({ logoUrl: result.secure_url });
});
// Multer middleware for logo upload (in-memory)
exports.uploadMiddleware = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
}).single('logo');
//# sourceMappingURL=settings.controller.js.map