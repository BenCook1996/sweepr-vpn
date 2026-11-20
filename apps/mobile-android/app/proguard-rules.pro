# Keep JNI entry points invoked by libwg-go.so (WireGuard tunnel AAR ships no consumer proguard.txt)
-keepclasseswithmembernames,includedescriptorclasses class com.wireguard.android.backend.GoBackend {
    native <methods>;
}
-keep class com.wireguard.android.backend.GoBackend$VpnService {
    public <init>();
}
-dontwarn com.wireguard.**
