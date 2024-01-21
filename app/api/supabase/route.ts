import { createClient } from "@supabase/supabase-js";
import { NextApiRequest, NextApiResponse } from 'next';
import { NextResponse } from "next/server";


const SUPABASE_URL: string = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_API_KEY: string = process.env.NEXT_PUBLIC_SUPABASE_API_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_API_KEY);

// Step 1: Define the TypeScript type for the data you're fetching.
interface HistoryList {
    game_id: string;
    round_id: number;
    turn_id: number;
    snake1action:string,
    snake2action:string,
    snake1reason:string,
    snake2reason:string,
    boardState:string
    
  }
  
 export async function POST(req: Request) {
    try {
        
        var { game_id } = await req.json();

      // Step 2 and 3: Use the `from` method on the `supabase` client to specify the table you're fetching from
      // and the `select` method to specify the columns you want to fetch.

      let { data, error } = await supabase
        .from('abcd_turn')
        .select('*').eq('game_id',game_id)
    
      // Step 4: Use a try-catch block to handle any errors that might occur during the fetch.
      if (error) throw error;
  
      return NextResponse.json(data);

    } catch (error) {
        // Raise error if something went wrong
        console.log(error)
        return NextResponse.json(null, { status: 500 })
    }

  }
