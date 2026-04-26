"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var client_1 = require("@prisma/client");
var bcryptjs_1 = __importDefault(require("bcryptjs"));
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var ownerPassword, owner, kasir1Password, kasir1, kasir2Password, kasir2, services, _i, services_1, service, _a, services_2, service, existing, stockItems, _b, stockItems_1, item, existing;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('Starting seed...');
                    return [4 /*yield*/, bcryptjs_1.default.hash('Owner123!', 10)];
                case 1:
                    ownerPassword = _c.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'owner@carwash.com' },
                            update: {},
                            create: {
                                name: 'Owner Carwash',
                                email: 'owner@carwash.com',
                                password: ownerPassword,
                                role: client_1.Role.OWNER,
                                isActive: true,
                            },
                        })];
                case 2:
                    owner = _c.sent();
                    console.log('Created owner:', owner.email);
                    return [4 /*yield*/, bcryptjs_1.default.hash('Kasir123!', 10)];
                case 3:
                    kasir1Password = _c.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'kasir1@carwash.com' },
                            update: {},
                            create: {
                                name: 'Kasir Satu',
                                email: 'kasir1@carwash.com',
                                password: kasir1Password,
                                role: client_1.Role.KASIR,
                                pin: '1234',
                                isActive: true,
                            },
                        })];
                case 4:
                    kasir1 = _c.sent();
                    console.log('Created kasir 1:', kasir1.email);
                    return [4 /*yield*/, bcryptjs_1.default.hash('Kasir123!', 10)];
                case 5:
                    kasir2Password = _c.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'kasir2@carwash.com' },
                            update: {},
                            create: {
                                name: 'Kasir Dua',
                                email: 'kasir2@carwash.com',
                                password: kasir2Password,
                                role: client_1.Role.KASIR,
                                pin: '5678',
                                isActive: true,
                            },
                        })];
                case 6:
                    kasir2 = _c.sent();
                    console.log('Created kasir 2:', kasir2.email);
                    services = [
                        // MOTOR
                        { name: 'Cuci Motor Reguler', description: 'Cuci motor reguler', price: 15000, category: client_1.VehicleType.MOTOR, durationMinutes: 20 },
                        { name: 'Cuci Motor Salon', description: 'Cuci motor salon lengkap', price: 25000, category: client_1.VehicleType.MOTOR, durationMinutes: 30 },
                        { name: 'Cuci + Wax Motor', description: 'Cuci motor + wax', price: 35000, category: client_1.VehicleType.MOTOR, durationMinutes: 40 },
                        // MOBIL
                        { name: 'Cuci Mobil Reguler', description: 'Cuci mobil reguler', price: 30000, category: client_1.VehicleType.MOBIL, durationMinutes: 30 },
                        { name: 'Cuci Mobil Salon', description: 'Cuci mobil salon lengkap', price: 50000, category: client_1.VehicleType.MOBIL, durationMinutes: 45 },
                        { name: 'Cuci + Wax Mobil', description: 'Cuci mobil + wax', price: 70000, category: client_1.VehicleType.MOBIL, durationMinutes: 60 },
                        { name: 'Poles Mobil', description: 'Poles mobil full', price: 150000, category: client_1.VehicleType.MOBIL, durationMinutes: 90 },
                        { name: 'Interior Cleaning', description: 'Cleaning interior mobil', price: 100000, category: client_1.VehicleType.MOBIL, durationMinutes: 60 },
                        // PICKUP
                        { name: 'Cuci Pickup', description: 'Cuci pickup', price: 45000, category: client_1.VehicleType.PICKUP, durationMinutes: 40 },
                        // TRUK
                        { name: 'Cuci Truk', description: 'Cuci truk', price: 75000, category: client_1.VehicleType.TRUK, durationMinutes: 60 },
                    ];
                    _i = 0, services_1 = services;
                    _c.label = 7;
                case 7:
                    if (!(_i < services_1.length)) return [3 /*break*/, 10];
                    service = services_1[_i];
                    return [4 /*yield*/, prisma.service.upsert({
                            where: { id: service.name }, // won't match, upsert by unique field
                            update: {},
                            create: service,
                        }).catch(function () {
                            // If unique constraint fails, create without upsert
                        })];
                case 8:
                    _c.sent();
                    _c.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 7];
                case 10:
                    _a = 0, services_2 = services;
                    _c.label = 11;
                case 11:
                    if (!(_a < services_2.length)) return [3 /*break*/, 15];
                    service = services_2[_a];
                    return [4 /*yield*/, prisma.service.findFirst({ where: { name: service.name } })];
                case 12:
                    existing = _c.sent();
                    if (!!existing) return [3 /*break*/, 14];
                    return [4 /*yield*/, prisma.service.create({ data: service })];
                case 13:
                    _c.sent();
                    _c.label = 14;
                case 14:
                    _a++;
                    return [3 /*break*/, 11];
                case 15:
                    console.log('Created services:', services.length);
                    stockItems = [
                        { name: 'Sabun Cair', unit: 'liter', currentStock: 20, minStock: 5, pricePerUnit: 25000 },
                        { name: 'Shampo Mobil', unit: 'liter', currentStock: 10, minStock: 3, pricePerUnit: 35000 },
                        { name: 'Semir Ban', unit: 'botol', currentStock: 15, minStock: 5, pricePerUnit: 20000 },
                        { name: 'Lap Microfiber', unit: 'pcs', currentStock: 30, minStock: 10, pricePerUnit: 15000 },
                        { name: 'Wax', unit: 'kg', currentStock: 5, minStock: 2, pricePerUnit: 50000 },
                    ];
                    _b = 0, stockItems_1 = stockItems;
                    _c.label = 16;
                case 16:
                    if (!(_b < stockItems_1.length)) return [3 /*break*/, 20];
                    item = stockItems_1[_b];
                    return [4 /*yield*/, prisma.stockItem.findFirst({ where: { name: item.name } })];
                case 17:
                    existing = _c.sent();
                    if (!!existing) return [3 /*break*/, 19];
                    return [4 /*yield*/, prisma.stockItem.create({ data: item })];
                case 18:
                    _c.sent();
                    _c.label = 19;
                case 19:
                    _b++;
                    return [3 /*break*/, 16];
                case 20:
                    console.log('Created stock items:', stockItems.length);
                    console.log('Seed completed!');
                    console.log('');
                    console.log('=== Login Credentials ===');
                    console.log('Owner: owner@carwash.com / Owner123!');
                    console.log('Kasir 1: kasir1@carwash.com / Kasir123! (PIN: 1234)');
                    console.log('Kasir 2: kasir2@carwash.com / Kasir123! (PIN: 5678)');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
