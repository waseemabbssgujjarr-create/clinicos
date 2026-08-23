export interface JwtPayload {
    id: string;
    clinicId: string;
    role: 'DOCTOR' | 'STAFF' | 'SUPERADMIN';
    email: string;
    plan?: string;
    staffRole?: string;
}
export declare function signToken(payload: JwtPayload): string;
export declare function verifyToken(token: string): JwtPayload;
