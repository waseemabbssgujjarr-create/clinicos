"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const c = require("../controllers/domain.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware, auth_middleware_1.doctorOrStaff);

router.get("/roster", c.roster);
router.post("/practitioners", auth_middleware_1.doctorOnly, c.createPractitioner);
router.post("/locations", auth_middleware_1.doctorOnly, c.createLocation);

router.get("/leave", c.listLeave);
router.post("/leave", auth_middleware_1.doctorOnly, c.createLeave);
router.delete("/leave/:id", auth_middleware_1.doctorOnly, c.deleteLeave);
router.get("/schedule-blocks", c.listBlocks);
router.post("/schedule-blocks", auth_middleware_1.doctorOnly, c.createBlock);
router.delete("/schedule-blocks/:id", auth_middleware_1.doctorOnly, c.deleteBlock);

router.get("/rooms", auth_middleware_1.doctorOnly, c.listRooms);
router.post("/rooms", auth_middleware_1.doctorOnly, c.createRoom);
router.patch("/rooms/:id", auth_middleware_1.doctorOnly, c.patchRoom);

const arWrite = auth_middleware_1.requireStaffRoles(["RECEPTIONIST", "MANAGER"]);
router.get("/patient-invoices", c.listInvoices);
router.post("/patient-invoices", arWrite, c.createInvoice);
router.post("/patient-payments", arWrite, c.recordPayment);
router.post("/patient-invoices/:id/void", arWrite, c.voidInvoice);

router.get("/documents", c.listDocuments);
router.get("/documents/:id/file", c.getDocumentFile);
router.post("/documents", c.createDocumentMeta);

router.get("/lab-orders", auth_middleware_1.requireChart, c.listLabOrders);
router.post("/lab-orders", auth_middleware_1.requireChart, c.createLabOrder);
router.patch("/lab-orders/:id", auth_middleware_1.requireChart, c.patchLabOrder);
router.post("/lab-orders/:id/results", auth_middleware_1.requireChart, c.addLabResult);

router.get("/inventory/skus", auth_middleware_1.doctorOnly, c.listSkus);
router.post("/inventory/skus", auth_middleware_1.doctorOnly, c.createSku);
router.post("/inventory/movements", auth_middleware_1.doctorOnly, c.moveStock);
router.get("/inventory/balance", auth_middleware_1.doctorOnly, c.stockBalance);

router.get("/tele-sessions", auth_middleware_1.doctorOnly, c.listTele);
router.post("/tele-sessions", auth_middleware_1.doctorOnly, c.createTele);
router.patch("/tele-sessions/:id", auth_middleware_1.doctorOnly, c.patchTele);

router.get("/coverages", c.listCoverages);
router.post("/coverages", arWrite, c.createCoverage);
router.get("/claims", c.listClaims);
router.post("/claims", arWrite, c.createClaim);

exports.default = router;
