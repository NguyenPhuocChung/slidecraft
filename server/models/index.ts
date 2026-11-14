/** Mongoose models (used by the mongo driver). Documents use a string `id` field as the public key. */
import mongoose, { Schema } from 'mongoose';

const opts = { versionKey: false as const, minimize: false, timestamps: false };
const base = { id: { type: String, required: true, unique: true, index: true }, createdAt: { type: String, required: true }, updatedAt: { type: String, required: true } };

export const UserSchema = new Schema({ ...base, email: { type: String, required: true, unique: true, lowercase: true }, name: String, passwordHash: { type: String, required: true } }, opts);
export const PresentationSchema = new Schema({
  ...base, owner: { type: String, index: true, required: true }, title: { type: String, required: true }, description: String, data: Schema.Types.Mixed, theme: String,
  slideCount: Number, version: Number, status: { type: String, enum: ['draft', 'exported', 'shared', 'archived'], index: true }, visibility: { type: String, enum: ['private', 'link', 'public'] },
  shareId: { type: String, index: true, sparse: true }, thumbnail: String, exportedAt: String, lastSnapshotAt: String, prevStatus: String,
}, opts);
export const VersionSchema = new Schema({ ...base, presentationId: { type: String, index: true }, owner: { type: String, index: true }, version: Number, title: String, slideCount: Number, data: Schema.Types.Mixed, reason: String }, opts);
export const AssetSchema = new Schema({ ...base, owner: { type: String, index: true }, name: String, mime: String, size: Number, type: String, file: String, width: Number, height: Number }, opts);
export const ExportSchema = new Schema({ ...base, owner: { type: String, index: true }, presentationId: { type: String, index: true }, format: String, profile: String, warnings: [String] }, opts);
export const ImportSchema = new Schema({ ...base, owner: { type: String, index: true }, format: String, slides: Number, errors: Number, warnings: Number, title: String }, { ...opts, suppressReservedKeysWarning: true });

export function getModels(conn: mongoose.Connection) {
  return {
    users: conn.model('User', UserSchema),
    presentations: conn.model('Presentation', PresentationSchema),
    versions: conn.model('Version', VersionSchema),
    assets: conn.model('Asset', AssetSchema),
    exports: conn.model('Export', ExportSchema),
    imports: conn.model('Import', ImportSchema),
  };
}
