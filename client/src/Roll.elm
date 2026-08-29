module Roll exposing (..)


type Stone
    = WhiteStone
    | BlackStone


initialStones : List Stone
initialStones =
    [ WhiteStone
    , BlackStone
    , WhiteStone
    , BlackStone
    ]


stoneLabel : Stone -> String
stoneLabel stone =
    case stone of
        WhiteStone ->
            "White"

        BlackStone ->
            "Black"
