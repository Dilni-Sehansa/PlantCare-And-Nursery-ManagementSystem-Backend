import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { SupplierModel, Status } from "../models/supplier.model";


// Generate SupId
const generateSupplierId = async () => {
    const suppliers = await SupplierModel.find(
        {},
        { supplierId: 1 }
    ).lean();

    let highestId = 0;

    suppliers.forEach((supplier) => {
        const match = supplier.supplierId.match(/^SUP(\d+)$/i);

        if (match) {
            const number = Number(match[1]);

            if (number > highestId) {
                highestId = number;
            }
        }
    });

    return `SUP${String(highestId + 1).padStart(3, "0")}`;
};


// Find Supplier 
const findSupplier = async (id: string) => {
    if (id.toUpperCase().startsWith("SUP")) {
        return await SupplierModel.findOne({
            supplierId: id.toUpperCase(),
        });
    }

    if (isValidObjectId(id)) {
        return await SupplierModel.findById(id);
    }

    return null;
};


// Save Supplier
export const createSupplier = async (req: Request,res: Response) => {
    try {
        const {
            supplierName,
            phone,
            email,
            address,
            status,
        } = req.body;

        if (
            typeof supplierName !== "string" ||
            !supplierName.trim() ||
            typeof phone !== "string" ||
            !phone.trim() ||
            typeof email !== "string" ||
            !email.trim() ||
            typeof address !== "string" ||
            !address.trim()
        ) {
            return res.status(400).json({
                message: "Supplier name, phone, email and address are required",
            });
        }

        const cleanPhone = phone.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (!/^0[0-9]{9}$/.test(cleanPhone)) {
            return res.status(400).json({
                message: "Enter a valid 10-digit phone number",
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({
                message: "Enter a valid email address",
            });
        }

        if (
            status !== undefined &&
            !Object.values(Status).includes(status)
        ) {
            return res.status(400).json({
                message: "Invalid supplier status",
            });
        }

        const existingPhone = await SupplierModel.findOne({
            phone: cleanPhone,
        });

        if (existingPhone) {
            return res.status(409).json({
                message: "Phone number already exists",
            });
        }

        const existingEmail = await SupplierModel.findOne({
            email: cleanEmail,
        });

        if (existingEmail) {
            return res.status(409).json({
                message: "Email already exists",
            });
        }

        const supplierId = await generateSupplierId();

        const supplier = await SupplierModel.create({
            supplierId,
            supplierName: supplierName.trim(),
            phone: cleanPhone,
            email: cleanEmail,
            address: address.trim(),
            status: status ?? Status.ACTIVE,
        });

        return res.status(201).json({
            message: "Supplier created successfully",
            supplier,
        });

    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "Supplier ID, phone or email already exists",
            });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: error.message,
            });
        }

        console.error("Create Supplier Error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};


// Get All Suppliers 
export const getAllSuppliers = async (req: Request,res: Response) => {
    try {
        const { search, status } = req.query;

        const filter: any = {};

        if (typeof search === "string" && search.trim()) {
            const escapedSearch = search
                .trim()
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            const searchRegex = new RegExp(escapedSearch, "i");

            filter.$or = [
                { supplierId: searchRegex },
                { supplierName: searchRegex },
                { phone: searchRegex },
                { email: searchRegex },
            ];
        }

        if (typeof status === "string") {
            if (!Object.values(Status).includes(status as Status)) {
                return res.status(400).json({
                    message: "Invalid supplier status",
                });
            }

            filter.status = status;
        }

        const suppliers = await SupplierModel.find(filter).sort({
            createdAt: -1,
        });

        return res.status(200).json({
            count: suppliers.length,
            suppliers,
        });

    } catch (error) {
        console.error("Get Suppliers Error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};


// Get Supplier by ID
export const getSupplierById = async (req: Request,res: Response) => {
    try {
        const supplierId = req.params.id;
        
        if (typeof supplierId !== "string") {
            return res.status(400).json({
                message: "Invalid supplier ID",
            });
        }
        const supplier = await findSupplier(supplierId);

        if (!supplier) {
            return res.status(404).json({
                message: "Supplier not found or invalid supplier ID",
            });
        }

        return res.status(200).json({
            supplier,
        });

    } catch (error) {
        console.error("Get Supplier Error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};


// Update Supplier
export const updateSupplier = async (req: Request,res: Response) => {
    try {
        const supplierId = req.params.id;
        
        if (typeof supplierId !== "string") {
            return res.status(400).json({
                message: "Invalid supplier ID",
            });
        }
        const supplier = await findSupplier(supplierId);

        if (!supplier) {
            return res.status(404).json({
                message: "Supplier not found or invalid supplier ID",
            });
        }

        const {
            supplierName,
            phone,
            email,
            address,
            status,
        } = req.body;

        if (supplierName !== undefined) {
            if (
                typeof supplierName !== "string" ||
                !supplierName.trim()
            ) {
                return res.status(400).json({
                    message: "Supplier name cannot be empty",
                });
            }
        }

        if (phone !== undefined) {
            if (
                typeof phone !== "string" ||
                !/^0[0-9]{9}$/.test(phone.trim())
            ) {
                return res.status(400).json({
                    message: "Enter a valid 10-digit phone number",
                });
            }

            const existingPhone = await SupplierModel.findOne({
                phone: phone.trim(),
                _id: { $ne: supplier._id },
            });

            if (existingPhone) {
                return res.status(409).json({
                    message: "Phone number already exists",
                });
            }
        }

        if (email !== undefined) {
            if (typeof email !== "string") {
                return res.status(400).json({
                    message: "Enter a valid email address",
                });
            }

            const cleanEmail = email.trim().toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(cleanEmail)) {
                return res.status(400).json({
                    message: "Enter a valid email address",
                });
            }

            const existingEmail = await SupplierModel.findOne({
                email: cleanEmail,
                _id: { $ne: supplier._id },
            });

            if (existingEmail) {
                return res.status(409).json({
                    message: "Email already exists",
                });
            }
        }

        if (address !== undefined) {
            if (
                typeof address !== "string" ||
                !address.trim()
            ) {
                return res.status(400).json({
                    message: "Address cannot be empty",
                });
            }
        }

        if (
            status !== undefined &&
            !Object.values(Status).includes(status)
        ) {
            return res.status(400).json({
                message: "Invalid supplier status",
            });
        }

        if (supplierName !== undefined) {
            supplier.supplierName = supplierName.trim();
        }

        if (phone !== undefined) {
            supplier.phone = phone.trim();
        }

        if (email !== undefined) {
            supplier.email = email.trim().toLowerCase();
        }

        if (address !== undefined) {
            supplier.address = address.trim();
        }

        if (status !== undefined) {
            supplier.status = status;
        }

        await supplier.save();

        return res.status(200).json({
            message: "Supplier updated successfully",
            supplier,
        });

    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "Supplier ID, phone or email already exists",
            });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: error.message,
            });
        }

        console.error("Update Supplier Error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};


// Delete Supplier
export const deleteSupplier = async (
    req: Request,
    res: Response
) => {
    try {
        const supplierId = req.params.id;
        
        if (typeof supplierId !== "string") {
            return res.status(400).json({
                message: "Invalid supplier ID",
            });
        }
        const supplier = await findSupplier(supplierId);

        if (!supplier) {
            return res.status(404).json({
                message: "Supplier not found or invalid supplier ID",
            });
        }

        await supplier.deleteOne();

        return res.status(200).json({
            message: "Supplier deleted successfully",
        });

    } catch (error) {
        console.error("Delete Supplier Error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};
