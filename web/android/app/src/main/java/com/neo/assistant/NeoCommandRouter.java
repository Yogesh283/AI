package com.neo.assistant;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import androidx.core.content.ContextCompat;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class NeoCommandRouter {
    private NeoCommandRouter() {}

    static boolean execute(Context context, String raw) {
        String text = normalize(raw);
        if (text.isEmpty()) return false;
        String digits = extractDigits(text);

        if (isWhatsAppIntent(text)) {
            Uri appUri = digits != null
                ? Uri.parse("whatsapp://send?phone=" + digits)
                : Uri.parse("whatsapp://send");
            Uri webUri = digits != null
                ? Uri.parse("https://wa.me/" + digits)
                : Uri.parse("https://web.whatsapp.com/");
            openAppOrWeb(
                context,
                "com.whatsapp",
                appUri,
                webUri
            );
            return true;
        }

        if (isTelegramIntent(text)) {
            Uri appUri = digits != null
                ? Uri.parse("tg://resolve?phone=%2B" + digits)
                : Uri.parse("tg://");
            openAppOrWeb(
                context,
                "org.telegram.messenger",
                appUri,
                Uri.parse("https://web.telegram.org/a/")
            );
            return true;
        }

        String tel = extractTel(text);
        if (tel != null) {
            Intent callIntent;
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE)
                == PackageManager.PERMISSION_GRANTED) {
                callIntent = new Intent(Intent.ACTION_CALL, Uri.parse(tel));
            } else {
                callIntent = new Intent(Intent.ACTION_DIAL, Uri.parse(tel));
            }
            callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(callIntent);
            return true;
        }

        return false;
    }

    private static String extractDigits(String t) {
        Matcher m = Pattern.compile("(\\+\\d[\\d\\s\\-.]{8,}\\d|\\d{10,})").matcher(t);
        if (!m.find()) return null;
        String digits = m.group(1).replaceAll("\\D", "");
        if (digits.length() == 10) digits = "91" + digits;
        if (digits.length() < 11) return null;
        return digits;
    }

    private static String normalize(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private static boolean isWhatsAppIntent(String t) {
        boolean hasWord = t.contains("whatsapp")
            || t.contains("व्हाट्सएप")
            || t.contains("वाट्सऐप")
            || t.contains("व्हाट्सऐप");
        if (!hasWord) return false;
        return t.matches(".*\\b(open|launch|start|show)\\b.*")
            || t.matches(".*\\bmy\\s+whatsapp\\b.*")
            || t.contains("ओपन")
            || t.contains("खोलो")
            || t.contains("खोल");
    }

    private static boolean isTelegramIntent(String t) {
        boolean hasWord = t.contains("telegram")
            || t.contains("टेलीग्राम")
            || t.contains("टेलिग्राम");
        if (!hasWord) return false;
        return t.matches(".*\\b(open|launch|start|show)\\b.*")
            || t.matches(".*\\bmy\\s+telegram\\b.*")
            || t.contains("ओपन")
            || t.contains("खोलो")
            || t.contains("खोल");
    }

    private static String extractTel(String t) {
        if (!(t.matches(".*\\b(call|dial|phone|ring)\\b.*")
            || t.contains("कॉल")
            || t.contains("फोन"))) {
            return null;
        }
        Matcher m = Pattern.compile("(\\+\\d[\\d\\s\\-.]{8,}\\d|\\d{10,})").matcher(t);
        if (!m.find()) return null;
        String digits = m.group(1).replaceAll("\\D", "");
        if (digits.length() == 10) digits = "91" + digits;
        if (digits.length() < 11) return null;
        return "tel:+" + digits;
    }

    private static void openAppOrWeb(Context context, String pkg, Uri appUri, Uri webUri) {
        Intent appIntent = new Intent(Intent.ACTION_VIEW, appUri);
        appIntent.setPackage(pkg);
        appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (appIntent.resolveActivity(context.getPackageManager()) != null) {
            context.startActivity(appIntent);
            return;
        }

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(pkg);
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(launch);
            return;
        }

        Intent webIntent = new Intent(Intent.ACTION_VIEW, webUri);
        webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(webIntent);
    }
}
