
import multer from "multer";
import path from "node:path";
import fs from "node:fs";

const uploadDirectory = path.resolve(process.cwd(), "uploads");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1_000_000_000
    )}${extension}`;

    callback(null, uniqueName);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req,file,callback) => {
  if (file.mimetype.startsWith("image/")) {
    callback(null, true);
  } else {
    callback(new Error("Only image files are allowed"));
  }
};

export const upload = multer({storage,fileFilter,limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
