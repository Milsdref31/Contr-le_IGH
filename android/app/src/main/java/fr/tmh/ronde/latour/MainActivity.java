package fr.tmh.ronde.latour;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propre à l'application : mise à jour depuis l'appli (voir UpdaterPlugin)
        registerPlugin(UpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
