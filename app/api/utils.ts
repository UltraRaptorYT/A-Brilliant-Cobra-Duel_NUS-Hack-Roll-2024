import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SUPABASE_URL: string = process.env.SUPABASE_URL || "";
const SUPABASE_API_KEY: string = process.env.SUPABASE_API_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_API_KEY);

export async function POST(req: Request) {
  const { user_id } = await req.json();

  const { data, error } = await supabase
    .from("abcd_user")
    .insert({ id: user_id })
  
  if (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

async function POSTabcd_round