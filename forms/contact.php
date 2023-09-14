<?php
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $name = $_POST["name"];
    $email = $_POST["email"];
    $subject = $_POST["subject"];
    $message = $_POST["message"];

  // Replace contact@example.com with your real receiving email address
  $receiving_email_address = 'vladneculaigabriel@gmail.com';

    // Create email headers
    $headers = "From: $name <$email>" . "\r\n";
    $headers .= "Reply-To: $email" . "\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8" . "\r\n";

    // Send the email
    if (mail($to, $subject, $message, $headers)) {
        $response = ["message" => "Email sent successfully"];
        echo json_encode($response);
    } else {
        http_response_code(500);
        echo json_encode(["message" => "Failed to send email"]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "Invalid request"]);
}
?>
