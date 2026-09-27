import React from "react";
import { Button, Typography, Breadcrumbs } from "@mui/material";
import { Link } from "react-router-dom";
import { NavigateNextIcon } from "@icons";
import { AddIcon } from "@icons";

const ConfigHeader = ({
    title,
    subtitle,
    onAdd,
    addLabel = "Add New",
    showAdd = true
}) => {
    return (
        <div className="mb-8">
            {/* Breadcrumbs could go here if needed, keeping it simple for now */}
            <Breadcrumbs
                separator={<NavigateNextIcon fontSize="small" />}
                aria-label="breadcrumb"
                className="mb-3"
            >
                <Link to="/dashboard" className="text-gray-500 hover:text-blue-600 no-underline text-sm">
                    Dashboard
                </Link>
                <Typography color="text.primary" className="text-sm">Website Config</Typography>
            </Breadcrumbs>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 tracking-tight">{title}</h1>
                    <p className="text-gray-500 mt-1">{subtitle}</p>
                </div>

                {showAdd && (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={onAdd}
                        sx={{
                            backgroundColor: "var(--primary-500)",
                            textTransform: "none",
                            borderRadius: "10px",
                            padding: "10px 24px",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                            fontWeight: 600,
                            "&:hover": {
                                backgroundColor: "var(--primary-600)",
                                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                            }
                        }}
                    >
                        {addLabel}
                    </Button>
                )}
            </div>
        </div>
    );
};

export default ConfigHeader;
