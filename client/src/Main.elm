port module Main exposing (main)

import Browser
import Html exposing (Html, button, div, h1, input, li, text, ul)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick, onInput)
import Http
import Json.Decode as Decode
import Json.Encode as Encode
import Time


-- FLAGS


type alias Flags =
    { apiBaseUrl : String
    , tableId : String
    }


-- MODEL


type Role
    = Facilitator
    | Player


type alias Auth =
    { userId : String
    , username : String
    , role : Role
    , sessionToken : String
    }


type alias Message =
    { id : String
    , authorId : String
    , authorName : String
    , role : Role
    , content : String
    , createdAt : Time.Posix
    }


type alias GameState =
    { sessionId : String
    , messages : List Message
    }


type alias Model =
    { flags : Flags
    , auth : Maybe Auth
    , gameState : Maybe GameState
    , newMessage : String
    , status : String
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( { flags = flags
      , auth = Nothing
      , gameState = Nothing
      , newMessage = ""
      , status = "Authorizing with Discord..."
      }
    , authorizeCmd [ "identify" ]
    )


-- MESSAGES


type Msg
    = GotBackendAuth (Result Http.Error Auth)
    | GotGameState (Result Http.Error GameState)
    | NewMessageChanged String
    | SendMessage
    | MessagePosted (Result Http.Error GameState)
    | FromDiscordRaw Decode.Value
    | NoOp


-- PORTS


port toDiscord : Encode.Value -> Cmd msg


port fromDiscord : (Decode.Value -> msg) -> Sub msg


authorizeCmd : List String -> Cmd Msg
authorizeCmd scopes =
    toDiscord <|
        Encode.object
            [ ( "type", Encode.string "Authorize" )
            , ( "scopes", Encode.list Encode.string scopes )
            ]


subscriptions : Model -> Sub Msg
subscriptions _ =
    fromDiscord FromDiscordRaw


-- DECODERS / ENCODERS


decodeRole : Decode.Decoder Role
decodeRole =
    Decode.string
        |> Decode.andThen
            (\s ->
                case s of
                    "facilitator" ->
                        Decode.succeed Facilitator

                    "player" ->
                        Decode.succeed Player

                    _ ->
                        Decode.fail "Unknown role"
            )


encodeRole : Role -> Encode.Value
encodeRole role =
    Encode.string <|
        case role of
            Facilitator ->
                "facilitator"

            Player ->
                "player"


decodeAuth : Decode.Decoder Auth
decodeAuth =
    Decode.map4 Auth
        (Decode.field "userId" Decode.string)
        (Decode.field "username" Decode.string)
        (Decode.field "role" decodeRole)
        (Decode.field "sessionToken" Decode.string)


decodeMessage : Decode.Decoder Message
decodeMessage =
    Decode.map6 Message
        (Decode.field "id" Decode.string)
        (Decode.field "authorId" Decode.string)
        (Decode.field "authorName" Decode.string)
        (Decode.field "role" decodeRole)
        (Decode.field "content" Decode.string)
        (Decode.field "createdAt" (Decode.map Time.millisToPosix Decode.int))


decodeGameState : Decode.Decoder GameState
decodeGameState =
    Decode.map2 GameState
        (Decode.field "sessionId" Decode.string)
        (Decode.field "messages" (Decode.list decodeMessage))


decodeFromDiscord : Decode.Decoder Msg
decodeFromDiscord =
    Decode.field "type" Decode.string
        |> Decode.andThen
            (\t ->
                case t of
                    "BackendAuthResult" ->
                        Decode.map (Ok >> GotBackendAuth)
                            (Decode.field "data" decodeAuth)

                    _ ->
                        Decode.succeed NoOp
            )


-- UPDATE


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        FromDiscordRaw value ->
            case Decode.decodeValue decodeFromDiscord value of
                Ok innerMsg ->
                    update innerMsg model

                Err _ ->
                    ( model, Cmd.none )

        GotBackendAuth (Ok auth) ->
            let
                cmd =
                    getGameStateCmd model.flags auth
            in
            ( { model
                | auth = Just auth
                , status = "Loaded auth as " ++ auth.username
              }
            , cmd
            )

        GotBackendAuth (Err _) ->
            ( { model | status = "Failed to authorize with backend." }, Cmd.none )

        GotGameState (Ok gs) ->
            ( { model | gameState = Just gs, status = "Connected." }, Cmd.none )

        GotGameState (Err _) ->
            ( { model | status = "Failed to load game state." }, Cmd.none )

        NewMessageChanged s ->
            ( { model | newMessage = s }, Cmd.none )

        SendMessage ->
            case ( model.auth, model.gameState ) of
                ( Just auth, Just _ ) ->
                    if String.trim model.newMessage == "" then
                        ( model, Cmd.none )

                    else
                        let
                            cmd =
                                postMessageCmd model.flags auth model.newMessage
                        in
                        ( { model | newMessage = "" }, cmd )

                _ ->
                    ( model, Cmd.none )

        MessagePosted (Ok gs) ->
            ( { model | gameState = Just gs }, Cmd.none )

        MessagePosted (Err _) ->
            ( { model | status = "Failed to post message." }, Cmd.none )

        NoOp ->
            ( model, Cmd.none )


-- HTTP HELPERS


backendBaseUrl : Flags -> String
backendBaseUrl flags =
    flags.apiBaseUrl


getGameStateCmd : Flags -> Auth -> Cmd Msg
getGameStateCmd flags auth =
    let
        url =
            backendBaseUrl flags
                ++ "/api/table/"
                ++ flags.tableId
                ++ "/messages"
                ++ "?sessionId="
                ++ flags.tableId
    in
    Http.request
        { method = "GET"
        , headers =
            [ Http.header "Authorization" ("Bearer " ++ auth.sessionToken) ]
        , url = url
        , body = Http.emptyBody
        , expect = Http.expectJson GotGameState decodeGameState
        , timeout = Nothing
        , tracker = Nothing
        }


postMessageCmd : Flags -> Auth -> String -> Cmd Msg
postMessageCmd flags auth content =
    let
        url =
            backendBaseUrl flags
                ++ "/api/table/"
                ++ flags.tableId
                ++ "/message"
                ++ "?sessionId="
                ++ flags.tableId

        body =
            Encode.object
                [ ( "content", Encode.string content )
                ]
    in
    Http.request
        { method = "POST"
        , headers =
            [ Http.header "Authorization" ("Bearer " ++ auth.sessionToken)
            , Http.header "Content-Type" "application/json"
            ]
        , url = url
        , body = Http.jsonBody body
        , expect = Http.expectJson MessagePosted decodeGameState
        , timeout = Nothing
        , tracker = Nothing
        }


-- VIEW


view : Model -> Html Msg
view model =
    div [ class "board-root" ]
        [ h1 [] [ text "TTRPG Shared Board" ]
        , div [] [ text model.status ]
        , viewMessages model
        , viewComposer model
        ]


viewMessages : Model -> Html Msg
viewMessages model =
    case model.gameState of
        Nothing ->
            div [] [ text "Loading messages..." ]

        Just gs ->
            ul [ class "message-list" ]
                (List.map viewMessage gs.messages)


viewMessage : Message -> Html Msg
viewMessage msg =
    let
        roleLabel =
            case msg.role of
                DungeonMaster ->
                    "[DM] "

                Player ->
                    ""
    in
    li []
        [ text (roleLabel ++ msg.authorName ++ ": " ++ msg.content) ]


viewComposer : Model -> Html Msg
viewComposer model =
    case model.auth of
        Nothing ->
            div [] [ text "Waiting for authentication..." ]

        Just _ ->
            div [ class "composer" ]
                [ input
                    [ type_ "text"
                    , placeholder "Write a message..."
                    , value model.newMessage
                    , onInput NewMessageChanged
                    ]
                    []
                , button [ onClick SendMessage ] [ text "Send" ]
                ]


-- PROGRAM


main : Program Flags Model Msg
main =
    Browser.element
        { init = init
        , update = update
        , view = view
        , subscriptions = subscriptions
        }
