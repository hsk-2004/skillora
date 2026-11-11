import type { NextConfig } from "next";
import path from "path";
import { loadEnvConfig } from "@next/env";

// One env file for the whole repo: load ../.env (repo root) before Next reads its config.
loadEnvConfig(path.resolve(__dirname, ".."));

const nextConfig: NextConfig = {};

export default nextConfig;
