/** Sketchy document model. Version 1.
 * Original image bytes are assets. Drawings, masks, and adjustments live on
 * an image edit project and never replace the asset.
 */

export const SKETCHY_FORMAT = "sketchy" as const;
export const SKETCHY_VERSION = 1 as const;

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface AssetRecord {
  id: string;
  mime: string;
  width: number;
  height: number;
  byteLength: number;
  name?: string;
}

export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: boolean;
  blur: number;
  pixelate: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

/** Normalized to the source image (0..1), so a mask survives resize. */
export type ImageMask =
  | { kind: "rect"; x: number; y: number; w: number; h: number; mode?: "keep" | "remove-outside" | "remove-inside" }
  | {
      kind: "polygon";
      /** x,y pairs, normalized 0..1 in source-image space. */
      points: number[];
      mode: "keep" | "remove-outside" | "remove-inside";
    };

export type DrawingKind =
  | "freehand"
  | "line"
  | "polyline"
  | "rect"
  | "ellipse"
  | "arc"
  | "polygon"
  | "bezier"
  | "text"
  | "arrow";

/** Geometry is in original-image pixel space, not board space. */
export interface DrawingObject {
  id: string;
  kind: DrawingKind;
  x: number;
  y: number;
  rotation: number;
  points?: number[];
  width?: number;
  height?: number;
  radiusX?: number;
  radiusY?: number;
  text?: string;
  fontSize?: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
  opacity: number;
}

export interface ImageEditProject {
  id: string;
  assetId: string;
  adjustments: Adjustments;
  mask: ImageMask | null;
  drawings: DrawingObject[];
}

interface BaseObject {
  id: string;
  x: number;
  y: number;
  rotation: number;
  locked: boolean;
}

export interface RectObject extends BaseObject {
  type: "rect";
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface EllipseObject extends BaseObject {
  type: "ellipse";
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface ArrowObject extends BaseObject {
  type: "arrow";
  points: number[];
  stroke: string;
  strokeWidth: number;
}

export interface PenObject extends BaseObject {
  type: "pen";
  points: number[];
  stroke: string;
  strokeWidth: number;
}

export interface TextObject extends BaseObject {
  type: "text";
  width: number;
  text: string;
  fontSize: number;
  fill: string;
}

export interface NoteObject extends BaseObject {
  type: "note";
  width: number;
  height: number;
  text: string;
  fill: string;
}

export interface ImageObject extends BaseObject {
  type: "image";
  width: number;
  height: number;
  assetId: string;
  imageProjectId: string;
}

/** Members stay independent objects. `childIds` are positions in this group's space. */
export interface GroupObject extends BaseObject {
  type: "group";
  width: number;
  height: number;
  childIds: string[];
}

/** A fixed artboard. Children are clipped to it and stored in frame space. */
export interface FrameObject extends BaseObject {
  type: "frame";
  name: string;
  width: number;
  height: number;
  fill: string;
  childIds: string[];
}

/** A line between two objects. Endpoints are derived from those objects, not stored pixels. */
export interface ConnectorObject extends BaseObject {
  type: "connector";
  fromId: string;
  toId: string;
  stroke: string;
  strokeWidth: number;
}

export type BoardObject =
  | RectObject
  | EllipseObject
  | ArrowObject
  | PenObject
  | TextObject
  | NoteObject
  | ImageObject
  | GroupObject
  | FrameObject
  | ConnectorObject;

export interface Board {
  id: string;
  name: string;
  camera: Camera;
  objects: BoardObject[];
}

export interface SketchyProject {
  format: typeof SKETCHY_FORMAT;
  version: typeof SKETCHY_VERSION;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  activeBoardId: string;
  boards: Board[];
  assets: Record<string, AssetRecord>;
  imageProjects: Record<string, ImageEditProject>;
}

export type Tool =
  | "select"
  | "pan"
  | "pen"
  | "rect"
  | "ellipse"
  | "arrow"
  | "text"
  | "note"
  | "link"
  | "frame";

export type IdFactory = (prefix: string) => string;
